import * as THREE from 'three';
import { CONSTANTS } from './Constants.js';

export class PedestrianSystem {
    constructor(scene) {
        this.scene = scene;
        this.pedestrians = [];
    }

    createHumanoid() {
        const group = new THREE.Group();
        
        // Materiales de colores variados
        const skinMat = new THREE.MeshLambertMaterial({ color: 0xffdcb1 });
        const shirtColors = [0x3b82f6, 0xef4444, 0x10b981, 0xf59e0b, 0x8b5cf6, 0xffffff];
        const pantsColors = [0x1e3a8a, 0x111827, 0x4b5563, 0x7c2d12];
        
        const shirtMat = new THREE.MeshLambertMaterial({ 
            color: shirtColors[Math.floor(Math.random() * shirtColors.length)] 
        });
        const pantsMat = new THREE.MeshLambertMaterial({ 
            color: pantsColors[Math.floor(Math.random() * pantsColors.length)] 
        });

        const isLow = CONSTANTS.QUALITY === 'low';

        // Cabeza
        const headGeom = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const head = new THREE.Mesh(headGeom, skinMat);
        head.position.y = 1.65;
        head.castShadow = !isLow;
        group.add(head);

        // Pelo
        const hairColors = [0x111111, 0x4a3000, 0x9e7314, 0x7a7a7a];
        const hairMat = new THREE.MeshLambertMaterial({ color: hairColors[Math.floor(Math.random() * hairColors.length)] });
        const hairGeom = new THREE.BoxGeometry(0.32, 0.1, 0.32);
        const hair = new THREE.Mesh(hairGeom, hairMat);
        hair.position.y = 1.8;
        head.add(hair);

        // Nariz (para saber a dónde mira)
        const noseGeom = new THREE.BoxGeometry(0.05, 0.1, 0.1);
        const nose = new THREE.Mesh(noseGeom, skinMat);
        nose.position.set(0, 1.65, 0.18);
        group.add(nose);

        // Ojos
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const eyeGeom = new THREE.BoxGeometry(0.05, 0.05, 0.02);
        const eyeL = new THREE.Mesh(eyeGeom, eyeMat);
        eyeL.position.set(-0.08, 1.7, 0.15);
        group.add(eyeL);
        const eyeR = new THREE.Mesh(eyeGeom, eyeMat);
        eyeR.position.set(0.08, 1.7, 0.15);
        group.add(eyeR);

        // Torso
        const torsoGeom = new THREE.BoxGeometry(0.5, 0.6, 0.3);
        const torso = new THREE.Mesh(torsoGeom, shirtMat);
        torso.position.y = 1.2;
        torso.castShadow = !isLow;
        group.add(torso);

        // Brazos (pivot point top)
        const armGeom = new THREE.BoxGeometry(0.15, 0.6, 0.15);
        armGeom.translate(0, -0.2, 0); // Ajustar pivote al hombro
        
        const armL = new THREE.Mesh(armGeom, shirtMat);
        armL.position.set(-0.35, 1.4, 0);
        armL.castShadow = !isLow;
        group.add(armL);

        const armR = new THREE.Mesh(armGeom, shirtMat);
        armR.position.set(0.35, 1.4, 0);
        armR.castShadow = !isLow;
        group.add(armR);

        // Piernas (pivot point top)
        const legGeom = new THREE.BoxGeometry(0.2, 0.8, 0.2);
        legGeom.translate(0, -0.4, 0); // Ajustar pivote a la cadera

        const shoeMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const shoeGeom = new THREE.BoxGeometry(0.2, 0.1, 0.25);
        shoeGeom.translate(0, -0.8, 0.05);

        const legL = new THREE.Mesh(legGeom, pantsMat);
        const shoeL = new THREE.Mesh(shoeGeom, shoeMat);
        legL.add(shoeL);
        legL.position.set(-0.15, 0.9, 0);
        legL.castShadow = !isLow;
        group.add(legL);

        const legR = new THREE.Mesh(legGeom, pantsMat);
        const shoeR = new THREE.Mesh(shoeGeom, shoeMat);
        legR.add(shoeR);
        legR.position.set(0.15, 0.9, 0);
        legR.castShadow = !isLow;
        group.add(legR);

        group.limbs = { armL, armR, legL, legR };
        return group;
    }

    // Spawnea un peatón en un cruce o calle
    spawnAt(x, z, dirX, dirZ, distance) {
        const mesh = this.createHumanoid();
        mesh.position.set(x, 0, z);
        
        // Rotar mirando hacia la dirección
        const angle = Math.atan2(dirX, dirZ);
        mesh.rotation.y = angle;

        this.scene.add(mesh);

        this.pedestrians.push({
            mesh: mesh,
            startX: x,
            startZ: z,
            dirX: dirX,
            dirZ: dirZ,
            distance: distance,
            progress: 0,
            speed: 1.0 + Math.random() * 1.5, // 1.0 a 2.5 m/s
            state: 'WALKING',
            boundingBox: new THREE.Box3()
        });
    }

    update(dt) {
        this.pedestrians.forEach(p => {
            if (p.state === 'WALKING') {
                p.progress += p.speed * dt;
                
                // Ida y vuelta
                const cycle = Math.floor(p.progress / p.distance);
                const isReturning = cycle % 2 !== 0;
                const localProgress = p.progress % p.distance;

                let currX = p.startX;
                let currZ = p.startZ;

                if (!isReturning) {
                    currX += p.dirX * localProgress;
                    currZ += p.dirZ * localProgress;
                    p.mesh.rotation.y = Math.atan2(p.dirX, p.dirZ);
                } else {
                    currX += p.dirX * (p.distance - localProgress);
                    currZ += p.dirZ * (p.distance - localProgress);
                    p.mesh.rotation.y = Math.atan2(-p.dirX, -p.dirZ);
                }

                p.mesh.position.x = currX;
                p.mesh.position.z = currZ;

                // Animar extremidades
                const walkCycle = (p.progress * 5) % (Math.PI * 2);
                p.mesh.limbs.legL.rotation.x = Math.sin(walkCycle) * 0.5;
                p.mesh.limbs.legR.rotation.x = Math.sin(walkCycle + Math.PI) * 0.5;
                p.mesh.limbs.armL.rotation.x = Math.sin(walkCycle + Math.PI) * 0.5;
                p.mesh.limbs.armR.rotation.x = Math.sin(walkCycle) * 0.5;

                // Actualizar Bounding Box para colisiones
                p.boundingBox.setFromObject(p.mesh);
            }
        });
    }
}
