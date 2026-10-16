import { CONSTANTS } from './Constants.js';

/**
 * PerformanceTracker — Registra todas las infracciones y cumplimientos
 * durante la partida para mostrar el resumen al finalizar.
 *
 * MATEMÁTICAS AGREGADAS:
 *   M01 — Conteo de ítems: aciertos, errores, omisiones
 *   M02 — Porcentaje de aciertos sobre el total de ítems
 *   M03 — Aprobado / No aprobado según MIN_PASS_PERCENT
 *   M06 — Registro único del intento (ID, fecha, estado)
 *   M15 — Distancia total recorrida y rapidez media
 */
export class PerformanceTracker {
    constructor() {
        this.violations  = []; // { ruleId, name, penalty, ordinance, timestamp, msgShort }
        this.compliances = []; // { ruleId, name, reward, timestamp, msgShort }
        this.startTime   = Date.now();

        // Cooldowns para no registrar el mismo evento mil veces
        this._cooldowns = {};

        // ── M01 — Conteo de ítems ────────────────────────────────
        // Un ítem es cada situación de tránsito que el jugador enfrenta.
        // Puede resultar en: acierto, error u omisión.
        this.aciertos   = 0;
        this.errores    = 0;
        this.omisiones  = 0;
        this.totalItems = CONSTANTS.TOTAL_ITEMS;

        // ── M06 — Registro único del intento ────────────────────
        // ID único generado con timestamp + código aleatorio
        this.intentoId   = `VELOX-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
        this.fechaInicio = new Date().toISOString();
        this.estado      = 'EN_CURSO'; // 'EN_CURSO' | 'FINALIZADO' | 'ABANDONADO'

        // ── M15 — Distancia y rapidez media ─────────────────────
        // distanciaMetros se acumula en cada frame desde GameEngine
        this.distanciaMetros = 0;
        // historial de velocidades en km/h para calcular la media
        this._historialVelocidades = [];
    }

    // ─── M01 — Registrar resultado de un ítem ────────────────────────────────
    // Llamar desde ScoringSystem o GameEngine cuando el jugador
    // pasa por una situación evaluable (semáforo, señal, cruce, etc.)
    // resultado: 'acierto' | 'error' | 'omision'
    registrarItem(resultado) {
        if (resultado === 'acierto')        this.aciertos++;
        else if (resultado === 'error')     this.errores++;
        else                                this.omisiones++;
    }

    // ─── M02 — Porcentaje de aciertos ────────────────────────────────────────
    // Fórmula: (aciertos / totalItems) × 100
    getPorcentajeAciertos() {
        if (this.totalItems === 0) return 0;
        return (this.aciertos / this.totalItems) * 100;
    }

    // ─── M03 — Aprobado o no aprobado ────────────────────────────────────────
    // Devuelve true si el porcentaje de aciertos >= MIN_PASS_PERCENT
    isAprobado() {
        return this.getPorcentajeAciertos() >= CONSTANTS.MIN_PASS_PERCENT;
    }

    // ─── M05 — Progreso de la prueba ─────────────────────────────────────────
    // Porcentaje de ítems completados (aciertos + errores + omisiones)
    getProgreso() {
        const completados = this.aciertos + this.errores + this.omisiones;
        if (this.totalItems === 0) return 0;
        return (completados / this.totalItems) * 100;
    }

    // ─── M15 — Acumular distancia en cada frame ──────────────────────────────
    // Llamar desde GameEngine.update(dt) pasando la velocidad en m/s
    // speedMs: velocidad actual del vehículo en m/s
    // dt: delta time en segundos
    actualizarDistancia(speedMs, dt) {
        const metros = Math.abs(speedMs) * dt;
        this.distanciaMetros += metros;

        // Guardar velocidad en km/h para calcular la media al final
        const kmh = Math.abs(speedMs) * 3.6;
        this._historialVelocidades.push(kmh);
    }

    // ─── M15 — Rapidez media ─────────────────────────────────────────────────
    // Fórmula: suma de todas las velocidades / cantidad de muestras
    getRapidezMedia() {
        if (this._historialVelocidades.length === 0) return 0;
        const suma = this._historialVelocidades.reduce((a, b) => a + b, 0);
        return suma / this._historialVelocidades.length;
    }

    // ─── Registrar una infracción (sin cambios) ───────────────────────────────
    recordViolation(ruleId, penalty, msgShort = '') {
        const now = Date.now();
        const cooldownKey = `V_${ruleId}`;
        if (this._cooldowns[cooldownKey] && now - this._cooldowns[cooldownKey] < 3000) return;
        this._cooldowns[cooldownKey] = now;

        const rule = CONSTANTS.RULES[ruleId] || { name: ruleId, ordinance: '' };
        this.violations.push({
            ruleId,
            name:      rule.name,
            ordinance: rule.ordinance,
            penalty,
            msgShort:  msgShort || rule.name,
            timestamp: Math.round((now - this.startTime) / 1000),
        });

        // M01 — cada violación cuenta como un error
        this.registrarItem('error');
    }

    // ─── Registrar un cumplimiento (sin cambios) ──────────────────────────────
    recordCompliance(ruleId, reward, msgShort = '') {
        const now = Date.now();
        const cooldownKey = `C_${ruleId}`;
        if (this._cooldowns[cooldownKey] && now - this._cooldowns[cooldownKey] < 5000) return;
        this._cooldowns[cooldownKey] = now;

        const rule = CONSTANTS.RULES[ruleId] || { name: ruleId, ordinance: '' };
        this.compliances.push({
            ruleId,
            name:      rule.name,
            reward,
            msgShort:  msgShort || rule.name,
            timestamp: Math.round((now - this.startTime) / 1000),
        });

        // M01 — cada cumplimiento cuenta como un acierto
        this.registrarItem('acierto');
    }

    // ─── Resumen final ────────────────────────────────────────────────────────
    getSummary(finalScore) {
        const totalPenalty  = this.violations.reduce((s, v) => s + v.penalty, 0);
        const totalReward   = this.compliances.reduce((s, c) => s + c.reward, 0);
        const rulesViolated = [...new Set(this.violations.map(v => v.ruleId))].length;
        const rulesMet      = [...new Set(this.compliances.map(c => c.ruleId))].length;
        const durationSec   = Math.round((Date.now() - this.startTime) / 1000);

        // ── M01 — calcular omisiones ──────────────────────────────
        // Ítems que el jugador no enfrentó ni como acierto ni como error
        const completados      = this.aciertos + this.errores;
        this.omisiones         = Math.max(0, this.totalItems - completados);

        // ── M02 — porcentaje de aciertos ─────────────────────────
        const porcentajeAciertos = parseFloat(this.getPorcentajeAciertos().toFixed(2));

        // ── M03 — aprobado / no aprobado ─────────────────────────
        const aprobado = this.isAprobado();

        // ── M15 — distancia y rapidez media ──────────────────────
        const distanciaMetros = Math.round(this.distanciaMetros);
        const rapidezMedia    = parseFloat(this.getRapidezMedia().toFixed(1));

        // Rating visual (calificación)
        let rating, ratingColor;
        if      (finalScore >= 90) { rating = 'Excelente 🏆'; ratingColor = '#22c55e'; }
        else if (finalScore >= 70) { rating = 'Bueno ✅';      ratingColor = '#84cc16'; }
        else if (finalScore >= 50) { rating = 'Regular ⚠️';   ratingColor = '#f59e0b'; }
        else                       { rating = 'Reprobado ❌';  ratingColor = '#ef4444'; }

        // Agrupar violaciones por regla (única con contador)
        const violationGroups = {};
        for (const v of this.violations) {
            if (!violationGroups[v.ruleId]) {
                violationGroups[v.ruleId] = { ...v, count: 0 };
            }
            violationGroups[v.ruleId].count++;
        }

        // M06 — marcar el intento como finalizado
        this.estado = 'FINALIZADO';

        return {
            // Datos originales (sin cambios)
            finalScore,
            totalPenalty,
            totalReward,
            rulesViolated,
            rulesMet,
            durationMin:     Math.floor(durationSec / 60),
            durationSec:     durationSec % 60,
            durationTotal:   durationSec,
            rating,
            ratingColor,
            violationGroups: Object.values(violationGroups),
            compliances:     this.compliances,

            // ── M01 — conteo de ítems ─────────────────────────────
            aciertos:        this.aciertos,
            errores:         this.errores,
            omisiones:       this.omisiones,
            totalItems:      this.totalItems,

            // ── M02 — porcentaje de aciertos ─────────────────────
            // Fórmula: (aciertos / totalItems) × 100
            porcentajeAciertos,

            // ── M03 — aprobado / no aprobado ─────────────────────
            // true si porcentajeAciertos >= MIN_PASS_PERCENT (70%)
            aprobado,

            // ── M06 — registro único del intento ─────────────────
            intentoId:       this.intentoId,
            fechaInicio:     this.fechaInicio,
            fechaFin:        new Date().toISOString(),
            estado:          this.estado,

            // ── M15 — distancia y rapidez media ──────────────────
            // Fórmula rapidez media: Σ velocidades / n muestras
            distanciaMetros,
            rapidezMedia,
        };
    }
}