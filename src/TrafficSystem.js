import * as THREE from 'three';
import { CONSTANTS } from './Constants.js';
import { VehicleController } from './VehicleController.js';

// Posición inicial del jugador — debe coincidir con VehicleController
// Estacionamiento Abierto en x=114, z=-104
const PLAYER_START_X = 114;
const PLAYER_START_Z = -104;
const SAFE_RADIUS_SQ = 100 * 100; // NPCs no spawnean dentro de 100m

export class TrafficSystem {
    constructor(scene) {
        this.scene = scene;
        this.intersections = [];
        this.timer = 0;
        this.state = 'GREEN_NS';
        this.stateTimer = 0;
        this.npcVehicles = [];
    }

    addIntersection(x, z) {
        const lightBoxGeom = new THREE.BoxGeometry(0.5, 1.5, 0.5);
        const lightBoxMat  = new THREE.MeshLambertMaterial({ color: 0x222222 });
        const poleGeom     = new THREE.CylinderGeometry(0.1, 0.1, 4);
        const poleMat      = new THREE.MeshLambertMaterial({ color: 0x888888 });

        const nsLight = new THREE.Group();
        const poleNS  = new THREE.Mesh(poleGeom, poleMat);
        poleNS.position.y = 2;
        const boxNS = new THREE.Mesh(lightBoxGeom, lightBoxMat);
        boxNS.position.y = 4;

        const redMatNS    = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const yellowMatNS = new THREE.MeshBasicMaterial({ color: 0x555500 });
        const greenMatNS  = new THREE.MeshBasicMaterial({ color: 0x005500 });

        const rLightNS = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1), redMatNS);
        rLightNS.rotation.x = Math.PI / 2; rLightNS.position.set(0, 4.5, 0.26);
        const yLightNS = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1), yellowMatNS);
        yLightNS.rotation.x = Math.PI / 2; yLightNS.position.set(0, 4.0, 0.26);
        const gLightNS = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1), greenMatNS);
        gLightNS.rotation.x = Math.PI / 2; gLightNS.position.set(0, 3.5, 0.26);

        nsLight.add(poleNS, boxNS, rLightNS, yLightNS, gLightNS);
        nsLight.position.set(x + CONSTANTS.INTERSECTION_SIZE / 2, 0, z + CONSTANTS.INTERSECTION_SIZE / 2);

        const ewLight = nsLight.clone();
        ewLight.rotation.y = Math.PI / 2;
        ewLight.position.set(x - CONSTANTS.INTERSECTION_SIZE / 2, 0, z + CONSTANTS.INTERSECTION_SIZE / 2);

        this.scene.add(nsLight);
        this.scene.add(ewLight);

        this.intersections.push({
            x, z, nsLight, ewLight,
            mats: {
                ns: { r: redMatNS, y: yellowMatNS, g: greenMatNS },
                ew: {
                    r: ewLight.children[2].material.clone(),
                    y: ewLight.children[3].material.clone(),
                    g: ewLight.children[4].material.clone()
                }
            }
        });

        const last = this.intersections[this.intersections.length - 1];
        ewLight.children[2].material = last.mats.ew.r;
        ewLight.children[3].material = last.mats.ew.y;
        ewLight.children[4].material = last.mats.ew.g;

        // Spawn NPC solo si está suficientemente lejos del jugador
        if (Math.random() > 0.5) {
            const isNS = Math.random() > 0.5;
            const npcX = isNS ? x + CONSTANTS.ROAD_WIDTH / 4 : x - 20;
            const npcZ = isNS ? z - 20 : z + CONSTANTS.ROAD_WIDTH / 4;

            // ──────────────────────────────────────────────────────────────────
            // ZONA SEGURA: no spawnear cerca del punto de inicio del jugador
            const dxSq = (npcX - PLAYER_START_X) ** 2;
            const dzSq = (npcZ - PLAYER_START_Z) ** 2;
            if (dxSq + dzSq > SAFE_RADIUS_SQ) {
                const dirX = isNS ? 0 : 1;
                const dirZ = isNS ? 1 : 0;
                this.spawnNPC(npcX, npcZ, dirX, dirZ);
            }
            // ──────────────────────────────────────────────────────────────────
        }
    }

    spawnNPC(x, z, dirX, dirZ) {
        const colors = [0x00cc44, 0x2255cc, 0xcc44cc, 0xcccc00, 0xff8800, 0xcc2222];
        const color  = colors[Math.floor(Math.random() * colors.length)];
        const group  = VehicleController.buildCarMesh(color);

        group.position.set(x, 0, z);
        group.rotation.y = Math.atan2(dirX, dirZ);

        this.scene.add(group);

        this.npcVehicles.push({
            mesh:        group,
            dirX,
            dirZ,
            speed:       4 + Math.random() * 4, // 4–8 m/s → ~14–29 km/h
            boundingBox: new THREE.Box3(),
        });
    }

    update(dt) {
        this.stateTimer += dt * 1000;

        switch (this.state) {
            case 'GREEN_NS':
                if (this.stateTimer > CONSTANTS.TRAFFIC_LIGHT_GREEN_TIME) {
                    this.state = 'YELLOW_NS'; this.stateTimer = 0;
                }
                this.updateLights(0x00ff00, 0xff0000);
                break;
            case 'YELLOW_NS':
                if (this.stateTimer > CONSTANTS.TRAFFIC_LIGHT_YELLOW_TIME) {
                    this.state = 'GREEN_EW'; this.stateTimer = 0;
                }
                this.updateLights(0xffff00, 0xff0000);
                break;
            case 'GREEN_EW':
                if (this.stateTimer > CONSTANTS.TRAFFIC_LIGHT_GREEN_TIME) {
                    this.state = 'YELLOW_EW'; this.stateTimer = 0;
                }
                this.updateLights(0xff0000, 0x00ff00);
                break;
            case 'YELLOW_EW':
                if (this.stateTimer > CONSTANTS.TRAFFIC_LIGHT_YELLOW_TIME) {
                    this.state = 'GREEN_NS'; this.stateTimer = 0;
                }
                this.updateLights(0xff0000, 0xffff00);
                break;
        }

        // Actualizar posición de cada NPC
        for (const npc of this.npcVehicles) {
            npc.mesh.position.x += npc.dirX * npc.speed * dt;
            npc.mesh.position.z += npc.dirZ * npc.speed * dt;

            if (npc.mesh.tires) {
                npc.mesh.tires.forEach(t => t.rotation.x -= npc.speed * dt);
            }

            // Reaparecer en el otro extremo del mapa,
            // pero NUNCA cerca del punto de inicio del jugador
            const bounds = CONSTANTS.BLOCK_SIZE * 3;
            let respawnX = npc.mesh.position.x;
            let respawnZ = npc.mesh.position.z;
            let needsRespawn = false;

            if (npc.mesh.position.x >  bounds) { respawnX = -bounds; needsRespawn = true; }
            if (npc.mesh.position.x < -bounds) { respawnX =  bounds; needsRespawn = true; }
            if (npc.mesh.position.z >  bounds) { respawnZ = -bounds; needsRespawn = true; }
            if (npc.mesh.position.z < -bounds) { respawnZ =  bounds; needsRespawn = true; }

            if (needsRespawn) {
                // Si el punto de reaparición es zona segura, desplazar 60u
                const dxSq = (respawnX - PLAYER_START_X) ** 2;
                const dzSq = (respawnZ - PLAYER_START_Z) ** 2;
                if (dxSq + dzSq < SAFE_RADIUS_SQ) {
                    // Alejar en la dirección de movimiento
                    respawnX += npc.dirX * 80;
                    respawnZ += npc.dirZ * 80;
                }
                npc.mesh.position.set(respawnX, 0, respawnZ);
            }

            npc.boundingBox.setFromObject(npc.mesh);
        }
    }

    updateLights(nsColor, ewColor) {
        this.intersections.forEach(inter => {
            inter.mats.ns.r.color.setHex(nsColor === 0xff0000 ? 0xff0000 : 0x550000);
            inter.mats.ns.y.color.setHex(nsColor === 0xffff00 ? 0xffff00 : 0x555500);
            inter.mats.ns.g.color.setHex(nsColor === 0x00ff00 ? 0x00ff00 : 0x005500);
            inter.mats.ew.r.color.setHex(ewColor === 0xff0000 ? 0xff0000 : 0x550000);
            inter.mats.ew.y.color.setHex(ewColor === 0xffff00 ? 0xffff00 : 0x555500);
            inter.mats.ew.g.color.setHex(ewColor === 0x00ff00 ? 0x00ff00 : 0x005500);
        });
    }

    checkViolations(vehicle, scoringSystem) {
        // Solo penalizar si el vehículo está en movimiento (evita falsos positivos en reposo)
        if (Math.abs(vehicle.speed) < 0.5) return;

        const threshold = CONSTANTS.INTERSECTION_SIZE / 2;

        for (const inter of this.intersections) {
            const distSq = (vehicle.mesh.position.x - inter.x) ** 2 +
                           (vehicle.mesh.position.z - inter.z) ** 2;

            if (distSq < threshold ** 2) {
                const angle    = vehicle.mesh.rotation.y % (Math.PI * 2);
                const movingNS = Math.abs(Math.cos(angle)) > 0.7;

                const redForNS = (this.state === 'GREEN_EW' || this.state === 'YELLOW_EW');
                const redForEW = (this.state === 'GREEN_NS' || this.state === 'YELLOW_NS');

                if ((movingNS && redForNS) || (!movingNS && redForEW)) {
                    if (!vehicle._penalizedRedLight) {
                        scoringSystem.penalize(
                            Math.abs(CONSTANTS.PENALTY_RED_LIGHT),
                            'Cruce semáforo en rojo',
                            'RULE_01'
                        );
                        vehicle._penalizedRedLight = true;
                        setTimeout(() => vehicle._penalizedRedLight = false, 5000);
                    }
                }
            }
        }
    }
}
