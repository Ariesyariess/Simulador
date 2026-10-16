import * as THREE from 'three';
console.log('[VeloX] VehicleController.js v8 cargado');
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONSTANTS } from './Constants.js';
import { createCarInterior, updateSpeedNeedle, setPedalPress, setTurnSignalStalk, DRIVER_X } from './CarInterior.js';

export class VehicleController {
    constructor(scene) {
        this.speed = 0;
        this.angle = 0;
        this.isLoaded = false;
        
        // Contenedor principal para que la posición y rotación funcionen de inmediato
        this.mesh = new THREE.Group();
        this.mesh.position.set(114, 0.5, -104);
        this.mesh.rotation.y = 0;
        scene.add(this.mesh);

        // Backup de partes importantes para animación
        this.wheelGroups = [];
        this.tires = [];
        this.brakeLights = [];
        this.signals = { left: [], right: [] };
        this.blinkTimer = 0;

        // Cargar el modelo 3D
        this.loadModel();

        this.boundingBox = new THREE.Box3();
        this.prevPosition = this.mesh.position.clone();
    }

    loadModel() {
        const loader = new GLTFLoader();
        loader.load('./models/auto1azul.glb', (gltf) => {
            const model = gltf.scene;

            // Activa sombra y arregla el vidrio 
            model.traverse(n => {
                if (n.isMesh) {
                    n.castShadow = true;
                    const mats = Array.isArray(n.material) ? n.material : [n.material];
                    mats.forEach(m => {
                        if (m && m.name && m.name.toLowerCase().includes('ventana')) {
                            m.transparent = true;
                            m.opacity = 0.55;
                            m.color.set(0x8fb8d8);
                        }
                    });
                }
            });

            // Centrado del modelo 
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            model.position.set(-center.x, -box.min.y, -center.z);

            // Escala del auto
            const scale = 4.6 / size.z;
            this.mesh.scale.set(scale, scale, scale);

            this.mesh.add(model);

            // Interior procedural (volante, tablero, asientos, etc.)
            const { group: interiorGroup, refs } = createCarInterior();
            model.add(interiorGroup);
            this.interiorRefs = refs;

            this.mesh.userData.eye = new THREE.Vector3(DRIVER_X, 0.44, 0.25).add(model.position);
            
            const tightSize = new THREE.Vector3(size.x * 0.8, size.y, size.z * 0.95);
            
            this.setupVehicleParts(model, tightSize);
            
            this.isLoaded = true;
            console.log("Modelo de auto cargado y centrado");
        }, undefined, (error) => {
            console.error("Error cargando el modelo del auto:", error);
           
            const fallbackMesh = VehicleController.buildCarMesh(0xff0000);
            this.mesh.add(fallbackMesh);
            this.wheelGroups = fallbackMesh.wheelGroups;
            this.tires = fallbackMesh.tires;
            this.brakeLights = fallbackMesh.brakeLights;
            this.signals = fallbackMesh.signals;
            this.isLoaded = true;
        });
    }

    setupVehicleParts(model, scaledSize) {
        
        this.modelLights = {
            brakes: [],
            left: [],
            right: []
        };

        model.traverse(node => {
            if (node.isMesh) {
                const name = node.name.toLowerCase();
s
                const mats = Array.isArray(node.material) ? node.material : [node.material];
                const matName = mats[0] && mats[0].name ? mats[0].name.toLowerCase() : '';

                const cloned = mats.map(m => {
                    if (!m) return m;
                    const c = m.clone();
                    if ('emissiveIntensity' in c) c.emissiveIntensity = 0;
                    if ('emissive' in c) c.emissive = new THREE.Color(0x000000);
                    return c;
                });
                node.material = Array.isArray(node.material) ? cloned : cloned[0];

                // Lógica de detección por nombre
                if (name.includes('brake') || matName.includes('brake') || name.includes('taillight')) {
                    this.modelLights.brakes.push(node);
                } else if (name.includes('indicator_l') || name.includes('signal_l') || name.includes('turn_l')) {
                    this.modelLights.left.push(node);
                } else if (name.includes('indicator_r') || name.includes('signal_r') || name.includes('turn_r')) {
                    this.modelLights.right.push(node);
                }

                // Ruedas
                if (name.includes('wheel') || name.includes('tire')) {
                    if (node.position.z > 0) this.wheelGroups.push(node);
                    this.tires.push(node);
                }
            }
        });

        if (this.modelLights.brakes.length === 0) {
            this.createVirtualLights(scaledSize);
        } else {
            this.brakeLights = this.modelLights.brakes;
            this.signals.left = this.modelLights.left;
            this.signals.right = this.modelLights.right;
        }
    }

    createVirtualLights(size) {
        
        const width = size.x;
        const height = size.y;
        const length = size.z;

        const lensGeom = new THREE.CylinderGeometry(0.1, 0.1, 0.02, 16);
        lensGeom.rotateX(Math.PI / 2);

        // --- LUCES DE FRENO  ---
        const brakeMat = new THREE.MeshPhysicalMaterial({ 
            color: 0x220000, 
            emissive: 0xff0000, 
            emissiveIntensity: 0,
            roughness: 0.1,
            metalness: 0.9,
            transparent: true,
            opacity: 0.9
        });

        this.brakeLights = [];
        this.brakePointLights = [];

        const positionsBrake = [
            [-width * 0.32, height * 0.3, -length * 0.46],
            [width * 0.32, height * 0.3, -length * 0.46]
        ];

        positionsBrake.forEach(pos => {
            const mesh = new THREE.Mesh(lensGeom, brakeMat.clone());
            mesh.position.set(...pos);
            mesh.rotation.y = Math.PI;
            
            const light = new THREE.PointLight(0xff0000, 0, 5, 2);
            light.position.set(0, 0, -0.1);
            mesh.add(light);
            
            this.mesh.add(mesh);
            this.brakeLights.push(mesh);
            this.brakePointLights.push(light);
        });

        // --- LUCES DE POSICIÓN TRASERAS  ---
        const taillightMat = new THREE.MeshBasicMaterial({ 
            color: 0xff0000 
        });
        const posTailL = new THREE.Mesh(lensGeom, taillightMat);
        posTailL.scale.set(0.7, 0.7, 1);
        posTailL.position.set(-width * 0.22, height * 0.35, -length * 0.47); // Un poco más atrás
        posTailL.rotation.y = Math.PI;
        const posTailR = posTailL.clone();
        posTailR.position.x = width * 0.22;
        this.mesh.add(posTailL, posTailR);

        // --- FAROS DELANTEROS  ---
        const headlightMat = new THREE.MeshBasicMaterial({ 
            color: 0xffffcc 
        });
        const headlightL = new THREE.Mesh(lensGeom, headlightMat);
        headlightL.scale.set(1.3, 1.3, 1);
        headlightL.position.set(-width * 0.35, height * 0.32, length * 0.46); // Un poco más adelante
        const headlightR = headlightL.clone();
        headlightR.position.x = width * 0.35;
        this.mesh.add(headlightL, headlightR);

        // Luz frontal 
        const frontLight = new THREE.SpotLight(0xffffff, 4, 40, Math.PI / 3.5, 0.5, 0.5);
        frontLight.position.set(0, height * 0.35, length * 0.4);
        const target = new THREE.Object3D();
        target.position.set(0, 0, length * 10);
        this.mesh.add(target);
        frontLight.target = target;
        this.mesh.add(frontLight);

        // --- SEÑALEROS  ---
        const signalMat = new THREE.MeshPhysicalMaterial({ 
            color: 0x331100, 
            emissive: 0xffaa00, 
            emissiveIntensity: 0,
            roughness: 0.1,
            metalness: 0.9,
            transparent: true,
            opacity: 0.9
        });

        this.signals = { left: [], right: [] };
        this.signalPointLights = { left: [], right: [] };

       
        const positionsSignal = [
            // Delanteros
            { pos: [-width * 0.4, height * 0.25, length * 0.42], side: 'right', rot: -Math.PI / 2.5 },
            { pos: [width * 0.4, height * 0.25, length * 0.42], side: 'left', rot: Math.PI / 2.5 },
            // Traseros
            { pos: [-width * 0.4, height * 0.25, -length * 0.42], side: 'right', rot: -Math.PI * 0.75 },
            { pos: [width * 0.4, height * 0.25, -length * 0.42], side: 'left', rot: Math.PI * 0.75 }
        ];

        positionsSignal.forEach(item => {
            const mesh = new THREE.Mesh(lensGeom, signalMat.clone());
            mesh.scale.set(0.7, 1.2, 0.7); 
            mesh.position.set(...item.pos);
            mesh.rotation.y = item.rot;
            
            const light = new THREE.PointLight(0xffaa00, 0, 4, 2);
            light.position.set(0, 0, 0.2);
            mesh.add(light);
            
            this.mesh.add(mesh);
            this.signals[item.side].push(mesh);
            this.signalPointLights[item.side].push(light);
        });
    }

    static buildCarMesh(colorHex) {
        const group = new THREE.Group();
        const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex });
        const darkMat = new THREE.MeshLambertMaterial({ color: 0x222222 });

        const chassisGeom = new THREE.BoxGeometry(2.1, 0.5, 4.6);
        const chassis = new THREE.Mesh(chassisGeom, bodyMat);
        chassis.position.y = 0.45;
        group.add(chassis);

        
        const wheelGeom = new THREE.CylinderGeometry(0.4, 0.4, 0.35, 24);
        wheelGeom.rotateZ(Math.PI / 2);
        const positions = [[-1.1, 0.4, 1.4], [1.1, 0.4, 1.4], [-1.1, 0.4, -1.4], [1.1, 0.4, -1.4]];
        group.wheelGroups = [];
        group.tires = [];
        positions.forEach(pos => {
            const w = new THREE.Mesh(wheelGeom, darkMat);
            w.position.set(...pos);
            group.add(w);
            group.tires.push(w);
            if (pos[2] > 0) group.wheelGroups.push(w);
        });

        // Luces para fallback
        const taillightGeom = new THREE.BoxGeometry(0.6, 0.15, 0.1);
        const tl1 = new THREE.Mesh(taillightGeom, new THREE.MeshBasicMaterial({ color: 0xaa0000 }));
        tl1.position.set(-0.6, 0.5, -2.35);
        const tl2 = new THREE.Mesh(taillightGeom, new THREE.MeshBasicMaterial({ color: 0xaa0000 }));
        tl2.position.set(0.6, 0.5, -2.35);
        group.add(tl1, tl2);
        group.brakeLights = [tl1, tl2];

        const signalGeom = new THREE.SphereGeometry(0.1, 8, 8);
        const sL = new THREE.Mesh(signalGeom, new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
        sL.position.set(-0.95, 0.5, 2.3);
        const sR = new THREE.Mesh(signalGeom, new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
        sR.position.set(0.95, 0.5, 2.3);
        group.add(sL, sR);
        group.signals = { left: [sL], right: [sR] };

        return group;
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
        const maxSpeedUnits = CONSTANTS.MAX_SPEED / 3.6;
        if (this.speed > maxSpeedUnits) this.speed = maxSpeedUnits;
        if (this.speed < -maxSpeedUnits / 2) this.speed = -maxSpeedUnits / 2;

        // Giro
        if (Math.abs(this.speed) > 0.1) {
            const turnDir = this.speed > 0 ? 1 : -1;
            if (keys.left) {
                this.mesh.rotation.y += CONSTANTS.TURN_SPEED * dt * turnDir;
                this.angle = Math.min(this.angle + dt * 5, 0.5);
            } else if (keys.right) {
                this.mesh.rotation.y -= CONSTANTS.TURN_SPEED * dt * turnDir;
                this.angle = Math.max(this.angle - dt * 5, -0.5);
            } else {
                this.angle *= 0.9;
            }
        }

        // Animación de partes 
        if (this.wheelGroups.length >= 2) {
            this.wheelGroups[0].rotation.y = this.angle;
            this.wheelGroups[1].rotation.y = this.angle;
        }
        this.tires.forEach(t => t.rotation.x -= this.speed * dt);

        // Luces de freno
        const isBraking = keys.backward || (this.speed > 0.1 && keys.backward);
        this.brakeLights.forEach((l, i) => {
            if (isBraking) {
                l.material.emissiveIntensity = 4;
                l.material.color.setHex(0xff0000);
                if (this.brakePointLights[i]) this.brakePointLights[i].intensity = 1.5;
            } else {
                l.material.emissiveIntensity = 0.1;
                l.material.color.setHex(0x330000);
                if (this.brakePointLights[i]) this.brakePointLights[i].intensity = 0;
            }
        });

        // Señaleros (Parpadeo)
        this.blinkTimer += dt;
        const blink = (this.blinkTimer % 0.6) > 0.3;
        
        ['left', 'right'].forEach(side => {
            const isActive = (side === 'left' ? keys.signalLeft : keys.signalRight) && blink;
            this.signals[side].forEach((l, i) => {
                l.material.emissiveIntensity = isActive ? 5 : 0;
                if (this.signalPointLights[side][i]) {
                    this.signalPointLights[side][i].intensity = isActive ? 1.0 : 0;
                }
            });
        });

        // Interior: aguja del velocímetro, pedales y palanca de giro
        if (this.interiorRefs) {
            updateSpeedNeedle(this.interiorRefs, Math.abs(this.speed) * 3.6);
            setPedalPress(this.interiorRefs, 'accel', keys.forward ? 1 : 0);
            setPedalPress(this.interiorRefs, 'brake', keys.backward ? 1 : 0);
            const stalkDir = keys.signalLeft ? -1 : (keys.signalRight ? 1 : 0);
            setTurnSignalStalk(this.interiorRefs, stalkDir);
        }

        // Movimiento
        this.mesh.translateZ(this.speed * dt);

        // Estado para reglas
        const wasAngleNeutral = Math.abs(this.prevAngle || 0) < 0.05;
        const isNowTurning    = Math.abs(this.angle) > 0.1;
        this.isTurning    = isNowTurning && !wasAngleNeutral;
        this.signalActive = keys.signalLeft || keys.signalRight;
        this.prevAngle    = this.angle;

        // Límites del mapa
        const limit = CONSTANTS.MAP_LIMIT || 280;
        if (Math.abs(this.mesh.position.x) > limit || Math.abs(this.mesh.position.z) > limit) {
            this.revertMove();
        }

        // Actualizar Bounding Box
        this.boundingBox.setFromObject(this.mesh);

        if (Math.abs(this.speed) < 0.01) this.speed = 0;
    }

    savePosition() {
        this.prevPosition.copy(this.mesh.position);
    }

    revertMove() {
        this.mesh.position.copy(this.prevPosition);
        this.speed *= -0.2;
    }

    setVRMode(isVR) {
        if (!this.isLoaded) return;
        this.mesh.children.forEach(child => {     
       if (child.type === 'Group' || child.type === 'Object3D') {
                child.visible = !isVR;
            }
        });
    }
}