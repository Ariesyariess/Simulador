import { CONSTANTS } from './Constants.js';

export class ScoringSystem {
    constructor(uiManager, performanceTracker) {
        this.score = 100;
        this.uiManager = uiManager;
        this.tracker = performanceTracker;

        this.lastSpeedingPenalized  = 0;
        this.lastInspectorPenalized = 0;
        this.lastYieldPenalized     = 0;
        this.lastLaneInvasion       = 0;
        this.lastTailgating         = 0;
        this.lastReverseWarned      = 0;
        this.lastWrongWayWarned     = 0; // RULE_09 contramano
        this.lastSignalPenalized    = 0; // RULE_27
        this.wasOffRoad             = false;
    }

    addPoints(amount, reason, ruleId = null) {
        this.score += amount;
        this.uiManager.showMessage(`+${amount} ${reason}`, false);
        if (ruleId && this.tracker) this.tracker.recordCompliance(ruleId, amount, reason);
    }

    penalize(amount, reason, ruleId = null) {
        this.score = Math.max(0, this.score - Math.abs(amount));
        this.uiManager.showMessage(`-${Math.abs(amount)} ${reason}`, true);
        if (ruleId && this.tracker) this.tracker.recordViolation(ruleId, Math.abs(amount), reason);
    }

    evaluateVehicle(vehicle, dt, zoneInfo, trafficSystem, worldGenerator) {
        const speedKmh = Math.abs(vehicle.speed * 3.6);
        const { currentLimit, isOffRoad, inYieldZone, inspectorStop } = zoneInfo;
        const now = Date.now();

        // RULE_18 / RULE_31 — Inspector de tránsito
        if (inspectorStop && speedKmh > 5) {
            if (now - this.lastInspectorPenalized > 3000) {
                this.penalize(CONSTANTS.PENALTY_INSPECTOR, '👮 No respetó orden del Inspector', 'RULE_18');
                this.lastInspectorPenalized = now;
            }
        }

        // RULE_07 / RULE_16 — Ceda el paso / Rotonda
        if (inYieldZone && speedKmh > CONSTANTS.ROUNDABOUT_SPEED_LIMIT) {
            if (now - this.lastYieldPenalized > 3000) {
                this.penalize(CONSTANTS.PENALTY_YIELD_SIGN, 'No respetó Ceda el Paso', 'RULE_07');
                this.lastYieldPenalized = now;
            }
        }

        // RULE_21 / RULE_22 / RULE_08 — Exceso de velocidad dinámico
        if (speedKmh > currentLimit) {
            if (now - this.lastSpeedingPenalized > 2000) {
                const ruleId = zoneInfo.inSchoolZone ? 'RULE_22' : 'RULE_21';
                const pen    = zoneInfo.inSchoolZone ? CONSTANTS.PENALTY_SCHOOL_SPEEDING : CONSTANTS.PENALTY_SPEEDING;
                this.penalize(pen, `Exceso de velocidad (Límite: ${currentLimit} km/h)`, ruleId);
                this.lastSpeedingPenalized = now;
            }
        }

        // RULE_27 — Señalero al girar
        if (vehicle.isTurning && !vehicle.signalActive) {
            if (now - this.lastSignalPenalized > 3000) {
                this.penalize(CONSTANTS.PENALTY_NO_SIGNAL, 'Maniobra sin señalero', 'RULE_27');
                this.lastSignalPenalized = now;
            }
        }

        // RULE_23 — Distancia de seguridad (3 segundos)
        if (trafficSystem && trafficSystem.npcVehicles) {
            const pos = vehicle.mesh.position;
            const dir = { x: Math.sin(vehicle.mesh.rotation.y), z: Math.cos(vehicle.mesh.rotation.y) };
            for (const npc of trafficSystem.npcVehicles) {
                const dx = npc.mesh.position.x - pos.x;
                const dz = npc.mesh.position.z - pos.z;
                const dot = dx * dir.x + dz * dir.z;
                const dist = Math.sqrt(dx*dx + dz*dz);
                const minDist = (vehicle.speed * 3.6 / 3.6) * 3; // 3 segundos en m/s
                if (dot > 0 && dist < minDist && dist < 30 && speedKmh > 15) {
                    if (now - this.lastTailgating > 4000) {
                        this.penalize(CONSTANTS.PENALTY_TAILGATING, 'Distancia de seguridad insuficiente (< 3 seg)', 'RULE_23');
                        this.lastTailgating = now;
                    }
                    break;
                }
            }
        }

        // RULE_39 — Reversa ilegal (> 20m acumulado)
        if (vehicle.speed < -0.5) {
            vehicle._reverseDistance = (vehicle._reverseDistance || 0) + Math.abs(vehicle.speed) * dt;
            if (vehicle._reverseDistance > 20) {
                if (now - this.lastReverseWarned > 5000) {
                    this.penalize(CONSTANTS.PENALTY_REVERSE, 'Marcha atrás prolongada no permitida', 'RULE_39');
                    this.lastReverseWarned = now;
                }
            }
        } else {
            vehicle._reverseDistance = 0;
        }

        // RULE_09 — Contramano en calle de un solo sentido
        if (worldGenerator) {
            const owResult = worldGenerator.checkOneWay(vehicle);
            if (owResult.wrongWay && Math.abs(vehicle.speed) > 1) {
                if (now - this.lastWrongWayWarned > 4000) {
                    this.penalize(15, '⛔ ¡CONTRAMANO! Calle de sentido único', 'RULE_09');
                    this.uiManager.showMessage('⛔ ¡CONTRAMANO! — Gire de inmediato', true);
                    this.lastWrongWayWarned = now;
                }
            }
        }

        // Salida de calzada
        if (isOffRoad && !zoneInfo.isInParking) {
            if (!this.wasOffRoad) {
                this.penalize(10, 'Fuera de la calzada');
                this.wasOffRoad = true;
            }
        } else {
            this.wasOffRoad = false;
        }

        // RULE_26 — Invasión de carril con tráfico en contra
        this.checkLaneInvasion(vehicle, trafficSystem);
    }

    checkLaneInvasion(vehicle, trafficSystem) {
        if (!trafficSystem || !trafficSystem.npcVehicles) return;
        const pos  = vehicle.mesh.position;
        const grid = 114;
        const cx   = Math.round(pos.x / grid) * grid;
        const cz   = Math.round(pos.z / grid) * grid;
        let inLeftLane = false;

        const dirX  = Math.sin(vehicle.mesh.rotation.y);
        const dirZ  = Math.cos(vehicle.mesh.rotation.y);
        const movingZ = Math.abs(dirZ) > Math.abs(dirX);

        if (movingZ && Math.abs(pos.x - cx) <= 7) {
            if (dirZ > 0 && pos.x > cx) inLeftLane = true;
            if (dirZ < 0 && pos.x < cx) inLeftLane = true;
        } else if (!movingZ && Math.abs(pos.z - cz) <= 7) {
            if (dirX > 0 && pos.z < cz) inLeftLane = true;
            if (dirX < 0 && pos.z > cz) inLeftLane = true;
        }

        if (inLeftLane) {
            let oncoming = false;
            for (const npc of trafficSystem.npcVehicles) {
                const distSq = (npc.mesh.position.x - pos.x)**2 + (npc.mesh.position.z - pos.z)**2;
                if (distSq < 1600) {
                    const dot = dirX * npc.dirX + dirZ * npc.dirZ;
                    if (dot < -0.5) { oncoming = true; break; }
                }
            }
            if (oncoming) {
                const now = Date.now();
                if (now - this.lastLaneInvasion > 4000) {
                    this.penalize(CONSTANTS.PENALTY_WRONG_LANE, 'Invasión de carril con tráfico en contra', 'RULE_26');
                    this.lastLaneInvasion = now;
                }
            }
        }
    }
}
