import * as THREE from 'three';
import { CONSTANTS } from './Constants.js';

export class VehicleController {
    constructor(scene) {
        this.speed = 0;
        this.angle = 0; // Ángulo de giro de las ruedas (steer)
        
        this.mesh = this.createVehicleMesh();
        // Estacionamiento Abierto en Bloque i=1, j=-1 (x=114, z=-114)
        // Posición segura dentro del estacionamiento
        this.mesh.position.set(114, 0.5, -104);
        this.mesh.rotation.y = 0; // Mirando al norte
        scene.add(this.mesh);

        // AABB (Bounding Box) para colisiones
        this.boundingBox = new THREE.Box3();
        this.prevPosition = this.mesh.position.clone();
    }

    static buildCarMesh(colorHex) {
        const group = new THREE.Group();

        // Materiales
        const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex });
        const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transmission: 1,
    opacity: 0.18,
    transparent: true,
    metalness: 0,
    roughness: 0.05,
    ior: 1.45,
    thickness: 0.02,
    side: THREE.DoubleSide
    });
        const darkMat = new THREE.MeshLambertMaterial({ color: 0x222222 });

        // Chasis inferior (Más bajo y aerodinámico)
        const chassisGeom = new THREE.BoxGeometry(2.1, 0.5, 4.6);
        const chassis = new THREE.Mesh(chassisGeom, bodyMat);
        chassis.position.y = 0.45;
        chassis.castShadow = true;
        group.add(chassis);

        // Cabina (Parte superior)
        const cabinGeom = new THREE.BoxGeometry(1.7, 0.65, 2.2);
        const cabin = new THREE.Mesh(cabinGeom, bodyMat);
        cabin.position.set(0, 1.05, -0.4);
        cabin.castShadow = true;
        group.add(cabin);

        // Parabrisas
        const windGeom = new THREE.PlaneGeometry(1.6, 0.8);
        const windshield = new THREE.Mesh(windGeom, glassMat);
        windshield.position.set(0, 1.05, 0.71);
        windshield.rotation.x = -Math.PI / 5; // Más inclinado
        group.add(windshield);

        // Vidrio Trasero
        const backGlass = new THREE.Mesh(windGeom, glassMat);
        backGlass.position.set(0, 1.05, -1.51);
        backGlass.rotation.x = Math.PI / 5;
        backGlass.rotation.y = Math.PI;
        group.add(backGlass);

        // Ventanas laterales
        const sideWinGeom = new THREE.PlaneGeometry(2.1, 0.55);
        const winL = new THREE.Mesh(sideWinGeom, glassMat);
        winL.position.set(-0.86, 1.05, -0.4);
        winL.rotation.y = -Math.PI / 2;
        group.add(winL);

        const winR = new THREE.Mesh(sideWinGeom, glassMat);
        winR.position.set(0.86, 1.05, -0.4);
        winR.rotation.y = Math.PI / 2;
        group.add(winR);

        // Alerón trasero (Spoiler)
        const spoilerGeom = new THREE.BoxGeometry(2.0, 0.1, 0.4);
        const spoiler = new THREE.Mesh(spoilerGeom, bodyMat);
        spoiler.position.set(0, 0.9, -2.1);
        group.add(spoiler);
        
        // Soportes del alerón
        const supportGeom = new THREE.BoxGeometry(0.1, 0.2, 0.2);
        const sL = new THREE.Mesh(supportGeom, bodyMat);
        sL.position.set(-0.6, 0.8, -2.0);
        const sR = new THREE.Mesh(supportGeom, bodyMat);
        sR.position.set(0.6, 0.8, -2.0);
        group.add(sL, sR);

        // Ruedas
        const wheelGeom = new THREE.CylinderGeometry(0.4, 0.4, 0.35, 24);
        wheelGeom.rotateZ(Math.PI / 2);
        
        // Rin
        const rimGeom = new THREE.CylinderGeometry(0.25, 0.25, 0.37, 8); // Hexagonal look
        rimGeom.rotateZ(Math.PI / 2);
        const rimMat = new THREE.MeshLambertMaterial({ color: 0xdddddd });

        const positions = [
            [-1.1, 0.4, 1.4], [1.1, 0.4, 1.4],   // Delanteras
            [-1.1, 0.4, -1.4], [1.1, 0.4, -1.4]  // Traseras
        ];

        group.wheelGroups = [];
        group.tires = []; // Para rotar de forma independiente sin romper el steering
        
        positions.forEach(pos => {
            const wheelGroup = new THREE.Group();
            
            const tireGroup = new THREE.Group();
            const tire = new THREE.Mesh(wheelGeom, darkMat);
            const rim = new THREE.Mesh(rimGeom, rimMat);
            tireGroup.add(tire, rim);
            
            wheelGroup.add(tireGroup);
            wheelGroup.position.set(...pos);
            group.add(wheelGroup);
            
            group.wheelGroups.push(wheelGroup);
            group.tires.push(tireGroup);
        });

        // Faros delanteros (Leds modernos)
        const headlightGeom = new THREE.BoxGeometry(0.6, 0.15, 0.1);
        const headlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const hl1 = new THREE.Mesh(headlightGeom, headlightMat);
        hl1.position.set(-0.6, 0.5, 2.35);
        const hl2 = new THREE.Mesh(headlightGeom, headlightMat);
        hl2.position.set(0.6, 0.5, 2.35);
        group.add(hl1, hl2);

        // Faros traseros (Freno)
        const taillightGeom = new THREE.BoxGeometry(0.6, 0.15, 0.1);
        const taillightMat = new THREE.MeshBasicMaterial({ color: 0xaa0000 });
        const tl1 = new THREE.Mesh(taillightGeom, taillightMat);
        tl1.position.set(-0.6, 0.5, -2.35);
        const tl2 = new THREE.Mesh(taillightGeom, taillightMat);
        tl2.position.set(0.6, 0.5, -2.35);
        group.add(tl1, tl2);
        
        group.brakeLights = [tl1, tl2];

        // Espejos retrovisores
        const mirrorGeom = new THREE.BoxGeometry(0.2, 0.15, 0.3);
        const mirrorL = new THREE.Mesh(mirrorGeom, bodyMat);
        mirrorL.position.set(-0.95, 0.9, 0.3);
        const mirrorR = new THREE.Mesh(mirrorGeom, bodyMat);
        mirrorR.position.set(0.95, 0.9, 0.3);
        group.add(mirrorL, mirrorR);

        // Matrícula (Placa) trasera
        const plateGeom = new THREE.PlaneGeometry(0.6, 0.2);
        const plateMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const plate = new THREE.Mesh(plateGeom, plateMat);
        plate.position.set(0, 0.45, -2.31);
        plate.rotation.y = Math.PI;
        group.add(plate);

        // Señaleros (Ambar)
        const signalGeom = new THREE.SphereGeometry(0.1, 8, 8);
        const signalMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        
        // Delanteros
        const sdL = new THREE.Mesh(signalGeom, signalMat.clone());
        sdL.position.set(-0.95, 0.5, 2.3);
        const sdR = new THREE.Mesh(signalGeom, signalMat.clone());
        sdR.position.set(0.95, 0.5, 2.3);
        
        // Traseros
        const stL = new THREE.Mesh(signalGeom, signalMat.clone());
        stL.position.set(-0.95, 0.5, -2.3);
        const stR = new THREE.Mesh(signalGeom, signalMat.clone());
        stR.position.set(0.95, 0.5, -2.3);
        
        group.add(sdL, sdR, stL, stR);
        group.signals = {
            left: [sdR, stR],  // Invertido para que coincida con la perspectiva deseada
            right: [sdL, stL]
        };

        return group;
    }

    createVehicleMesh() {
        const mesh = VehicleController.buildCarMesh(0xff0000); // Rojo para el jugador
        this.wheelGroups = mesh.wheelGroups;
        this.tires = mesh.tires;
        this.brakeLights = mesh.brakeLights;
        this.signals = mesh.signals;
        this.blinkTimer = 0;
        return mesh;
    }

    update(dt, inputManager) {
        const keys = inputManager.keys;

        // Aceleración
        if (keys.forward) {
            this.speed += CONSTANTS.ACCELERATION * dt;
        } else if (keys.backward) {
            this.speed -= CONSTANTS.BRAKING * dt;
        } else {
            // Fricción
            if (this.speed > 0) {
                this.speed -= CONSTANTS.FRICTION * dt;
                if (this.speed < 0) this.speed = 0;
            } else if (this.speed < 0) {
                this.speed += CONSTANTS.FRICTION * dt;
                if (this.speed > 0) this.speed = 0;
            }
        }

        // Límite de velocidad
        const maxSpeedUnits = CONSTANTS.MAX_SPEED / 3.6; // km/h a m/s
        if (this.speed > maxSpeedUnits) this.speed = maxSpeedUnits;
        if (this.speed < -maxSpeedUnits / 2) this.speed = -maxSpeedUnits / 2; // Reversa más lenta

        // Giro
        // Solo puede girar si se está moviendo
        if (Math.abs(this.speed) > 0.1) {
            const turnDir = this.speed > 0 ? 1 : -1;
            if (keys.left) {
                this.mesh.rotation.y += CONSTANTS.TURN_SPEED * dt * turnDir;
                this.angle = Math.min(this.angle + dt * 5, 0.5);
            } else if (keys.right) {
                this.mesh.rotation.y -= CONSTANTS.TURN_SPEED * dt * turnDir;
                this.angle = Math.max(this.angle - dt * 5, -0.5);
            } else {
                this.angle *= 0.9; // Volver al centro
            }
        }

        // Animar ruedas delanteras (índices 0 y 1)
        this.wheelGroups[0].rotation.y = this.angle;
        this.wheelGroups[1].rotation.y = this.angle;

        // Animar rotación de las ruedas por la velocidad
        // Al rotar la llanta interna en vez del grupo, evitamos el bug visual
        this.tires.forEach(t => t.rotation.x -= this.speed * dt);

        // Luces de freno
        if (keys.backward || (this.speed > 0 && keys.backward)) {
            this.brakeLights.forEach(l => l.material.color.setHex(0xff0000));
        } else {
            this.brakeLights.forEach(l => l.material.color.setHex(0x550000));
        }

        // Señaleros (Parpadeo)
        this.blinkTimer += dt;
        const blink = (this.blinkTimer % 0.6) > 0.3;
        
        this.signals.left.forEach(l => l.visible = keys.signalLeft && blink);
        this.signals.right.forEach(r => r.visible = keys.signalRight && blink);

        // Movimiento
        this.mesh.translateZ(this.speed * dt);

        // Estado para RULE_27 (señalero al girar)
        const wasAngleNeutral = Math.abs(this.prevAngle || 0) < 0.05;
        const isNowTurning    = Math.abs(this.angle) > 0.1;
        this.isTurning    = isNowTurning && !wasAngleNeutral;
        this.signalActive = keys.signalLeft || keys.signalRight;
        this.prevAngle    = this.angle;

        // Límites del mapa (no salir volando)
        const limit = CONSTANTS.MAP_LIMIT || 280;
        if (Math.abs(this.mesh.position.x) > limit || Math.abs(this.mesh.position.z) > limit) {
            this.revertMove();
        }

        // Actualizar Bounding Box
        this.boundingBox.setFromObject(this.mesh);

        // Umbral mínimo para evitar drift visual
        if (Math.abs(this.speed) < 0.01) this.speed = 0;
    }

    savePosition() {
        this.prevPosition.copy(this.mesh.position);
    }

    revertMove() {
        this.mesh.position.copy(this.prevPosition);
        this.speed *= -0.2; // Rebote leve
    }
}
