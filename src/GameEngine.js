import { SceneManager } from './SceneManager.js';
import { InputManager } from './InputManager.js';
import { VehicleController } from './VehicleController.js';
import { TrafficSystem } from './TrafficSystem.js';
import { PedestrianSystem } from './PedestrianSystem.js';
import { WorldGenerator } from './WorldGenerator.js';
import { UIManager } from './UIManager.js';
import { ScoringSystem } from './ScoringSystem.js';
import { SoundManager } from './SoundManager.js';
import { PerformanceTracker } from './PerformanceTracker.js';
import { CONSTANTS } from './Constants.js';
import { VRManager } from './VRManager.js';

export class GameEngine {
    constructor() {
        this.lastTime  = 0;
        this.isRunning = false;

        this.sceneManager     = new SceneManager('webgl-canvas');
        this.inputManager     = new InputManager();
        this.uiManager        = new UIManager();
        this.vrManager        = new VRManager(this.sceneManager, this);
        this.tracker          = new PerformanceTracker();
        this.scoringSystem    = new ScoringSystem(this.uiManager, this.tracker);
        this.soundManager     = new SoundManager();

        this.vehicle          = new VehicleController(this.sceneManager.scene);
        this.trafficSystem    = new TrafficSystem(this.sceneManager.scene);
        this.pedestrianSystem = new PedestrianSystem(this.sceneManager.scene);

        this.worldGenerator   = new WorldGenerator(
            this.sceneManager.scene,
            this.trafficSystem,
            this.pedestrianSystem
        );
        // Mapa más chico (antes 3 = grilla 7x7 ≈ 49 cuadras) para bajar la
        // cantidad total de edificios/autos/peatones en memoria de video.
        // Si tu compu lo banca bien, podés subirlo de nuevo a 3.
        this.worldGenerator.generateCity(2).then(() => {
            try {
                this.sceneManager.render();
            } catch (err) {
                console.error('Error renderizando tras generar la ciudad:', err);
            }
        });

        window.gameEngine = this;
        this.animate = this.animate.bind(this);
    }

    start() {
        this.isRunning = true;
        this.lastTime  = performance.now();

        const renderer = this.sceneManager.renderer;
        renderer.xr.addEventListener('sessionstart', () => {
            this.vrManager.toggleVR(true);
            this.vehicle.setVRMode(true);
        });
        renderer.xr.addEventListener('sessionend', () => {
            this.vrManager.toggleVR(false);
            this.vehicle.setVRMode(false);
        });

        renderer.setAnimationLoop(this.animate);
    }

    stop(reason) {
        this.isRunning = false;
        const summary = this.tracker.getSummary(this.scoringSystem.score);
        this.uiManager.showSummary(reason, summary);
        this.soundManager.playCrash();
    }

    animate(time) {
        if (!this.isRunning) return;
        try {
            this._animateFrame(time);
        } catch (err) {
            // IMPORTANTE: renderer.setAnimationLoop deja de llamar a este método
            // para siempre si un cuadro tira un error sin atrapar (el juego
            // "se congela"). Atrapamos acá para que un error puntual en un
            // cuadro no tumbe el juego entero; queda igual registrado en
            // consola para poder encontrar y arreglar la causa real.
            console.error('Error en animate() — se saltea este cuadro:', err);
        }
    }

    _animateFrame(time) {
        // Calcular deltaTime en segundos
        const dt     = (time - this.lastTime) / 1000;
        this.lastTime = time;

        // Limitar dt por si la pestaña se inactiva
        const safeDt = Math.min(dt, 0.1);

        // ── M04 — Tiempo restante ──────────────────────────────────────────
        // Fórmula: tiempoRestante = TEST_TIME_LIMIT − duracionActual
        // Se muestra en pantalla sin valores negativos (Math.max)
        const tiempoRestante = Math.max(
            0,
            CONSTANTS.TEST_TIME_LIMIT - this.tracker.duration
        );
        const minRestantes = Math.floor(tiempoRestante / 60);
        const segRestantes = Math.floor(tiempoRestante % 60);
        this.uiManager.updateTiempoRestante(minRestantes, segRestantes);
        // ──────────────────────────────────────────────────────────────────

        // ── M15 — Acumular distancia recorrida ────────────────────────────
        // Se pasa la velocidad en m/s y el delta time para calcular metros
        // El PerformanceTracker acumula: distancia += |speed| × dt
        // También guarda la velocidad en km/h para la rapidez media
        this.tracker.actualizarDistancia(this.vehicle.speed, safeDt);
        // ──────────────────────────────────────────────────────────────────

        // Actualizar módulos lógicos
        this.inputManager.updateGamepad();
        this.vehicle.savePosition();
        this.vehicle.update(safeDt, this.inputManager);
        this.trafficSystem.update(safeDt);
        this.pedestrianSystem.update(safeDt);
        this.worldGenerator.update(safeDt);

        this.trafficSystem.checkViolations(this.vehicle, this.scoringSystem);
        const zoneInfo = this.worldGenerator.checkZones(this.vehicle, this.uiManager);
        this.scoringSystem.evaluateVehicle(
            this.vehicle, safeDt, zoneInfo,
            this.trafficSystem, this.worldGenerator
        );

        // Sonido
        this.soundManager.updateEngine(this.vehicle.speed * 3.6);
        if (this.inputManager.keys.honk) {
            this.soundManager.playHonk();
            this.inputManager.keys.honk = false;
        }

        // Lógica de PARE
        if (this.activeStopZones) {
            for (let oldZone of this.activeStopZones) {
                if (!zoneInfo.activeStopZones.includes(oldZone)) {
                    if (!oldZone.completed) {
                        this.scoringSystem.penalize(
                            CONSTANTS.PENALTY_STOP_SIGN,
                            'No respetó señal de PARE'
                        );
                    }
                    oldZone.completed = false;
                }
            }
        }
        this.activeStopZones = zoneInfo.activeStopZones;

        // Colisiones con peatones
        for (let p of this.pedestrianSystem.pedestrians) {
            if (p.boundingBox && this.vehicle.boundingBox.intersectsBox(p.boundingBox)) {
                this.stop('Atropellaste a un peatón.');
                return;
            }
        }

        // Colisiones con vehículos NPC
        for (let v of this.trafficSystem.npcVehicles || []) {
            if (v.boundingBox && this.vehicle.boundingBox.intersectsBox(v.boundingBox)) {
                if (Math.abs(this.vehicle.speed) > 5) {
                    this.stop('Chocaste con otro vehículo.');
                } else {
                    this.vehicle.revertMove();
                    this.scoringSystem.penalize(2, 'Roce con vehículo');
                }
                return;
            }
        }

        // Colisiones con edificios
        for (let bBox of this.worldGenerator.buildingBoxes) {
            if (this.vehicle.boundingBox.intersectsBox(bBox)) {
                if (Math.abs(this.vehicle.speed) > 8) {
                    this.stop('Choque violento contra edificio.');
                } else {
                    this.vehicle.revertMove();
                    this.scoringSystem.penalize(5, 'Choque contra propiedad');
                }
                return;
            }
        }

        // Lógica de finalización — puntaje y tiempo
        if (this.scoringSystem.score < CONSTANTS.PASS_POINTS_LIMIT) {
            this.stop('Puntaje insuficiente para continuar la prueba.');
            return;
        }

        if (this.tracker.duration >= CONSTANTS.TEST_TIME_LIMIT) {
            if (this.scoringSystem.score >= CONSTANTS.PASS_POINTS_LIMIT) {
                this.stop('¡PRUEBA APROBADA! Felicitaciones, ha demostrado buen dominio de las normas.');
            } else {
                this.stop('Tiempo agotado. No alcanzó el puntaje mínimo requerido.');
            }
            return;
        }

        this.uiManager.update(safeDt, this.vehicle, this.scoringSystem, this.inputManager);
        this.vrManager.update(safeDt, this.vehicle);
        this.drawMinimap();

        this.sceneManager.updateCamera(this.vehicle.mesh);
        this.sceneManager.render();
    }

    drawMinimap() {
        const canvas = document.getElementById('minimap-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w   = canvas.width;
        const h   = canvas.height;

        ctx.clearRect(0, 0, w, h);

        const scale   = 0.6;
        const centerX = w / 2;
        const centerY = h / 2;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(-this.vehicle.mesh.rotation.y);

        const bx = this.vehicle.mesh.position.x;
        const bz = this.vehicle.mesh.position.z;

        // Calles
        ctx.fillStyle = '#444';
        this.trafficSystem.intersections.forEach(inter => {
            const dx = (inter.x - bx) * scale;
            const dz = (inter.z - bz) * scale;
            if (Math.abs(dx) < w && Math.abs(dz) < h) {
                ctx.fillRect(dx - 100, dz - 8,  200, 16);
                ctx.fillRect(dx - 8,   dz - 100, 16, 200);
            }
        });

        // NPCs
        ctx.fillStyle = '#3b82f6';
        if (this.trafficSystem.npcVehicles) {
            this.trafficSystem.npcVehicles.forEach(npc => {
                const dx = (npc.mesh.position.x - bx) * scale;
                const dz = (npc.mesh.position.z - bz) * scale;
                if (Math.abs(dx) < w / 2 && Math.abs(dz) < h / 2) {
                    ctx.fillRect(dx - 1.5, dz - 3, 3, 6);
                }
            });
        }

        // Auto del jugador
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-1.5, -3, 3, 6);

        // Semáforos
        this.trafficSystem.intersections.forEach(inter => {
            const dx = (inter.x - bx) * scale;
            const dz = (inter.z - bz) * scale;
            if (Math.abs(dx) < w / 2 && Math.abs(dz) < h / 2) {
                ctx.beginPath();
                ctx.arc(dx, dz, 3, 0, Math.PI * 2);
                ctx.fillStyle = this.trafficSystem.state.includes('NS')
                    ? '#22c55e'
                    : '#ef4444';
                ctx.fill();
            }
        });

        ctx.restore();
    }
}