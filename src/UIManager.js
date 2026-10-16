export class UIManager {
    constructor() {
        this.speedValue    = document.getElementById('speed-text');
        this.speedNeedle   = document.getElementById('speed-needle');
        this.visualWheel   = document.getElementById('visual-wheel');
        this.gearValue     = document.getElementById('gear-value');
        this.scoreValue    = document.getElementById('score-value');
        this.indLeft       = document.getElementById('ind-left');
        this.indRight      = document.getElementById('ind-right');
        this.systemMessage = document.getElementById('system-message');

        this.blinkTimer     = 0;
        this.messageTimeout = null;

        this.setupOptionsHandlers();
    }

    setupOptionsHandlers() {
        const btnOptions   = document.getElementById('btn-options');
        const optionsModal = document.getElementById('options-modal');
        const btnSave      = document.getElementById('btn-options-save');
        const fileInput    = document.getElementById('opt-radio-file');

        if (btnOptions) {
            btnOptions.onclick = () => optionsModal.classList.remove('hidden');
        }

        if (btnSave) {
            btnSave.onclick = () => {
                // Guardar Calidad
                const quality = document.getElementById('opt-quality').value;
                import('./Constants.js').then(m => m.CONSTANTS.QUALITY = quality);

                // Guardar Tiempo y Puntaje
                const time  = parseInt(document.getElementById('opt-test-time').value);
                const score = parseInt(document.getElementById('opt-pass-score').value);
                import('./Constants.js').then(m => {
                    m.CONSTANTS.TEST_TIME_LIMIT   = time;
                    m.CONSTANTS.PASS_POINTS_LIMIT = score;
                });

                // Cambiar Radio si se subió un archivo
                if (fileInput && fileInput.files[0]) {
                    const file = fileInput.files[0];
                    const url  = URL.createObjectURL(file);
                    window.gameEngine.soundManager.setRadio(url, file.name.split('.')[0]);
                } else {
                    const url = document.getElementById('opt-radio-url').value;
                    if (url) {
                        let name = 'RADIO ONLINE';
                        if (url.includes('radiopro.uy')) name = 'Esteña FM - Castillos';
                        window.gameEngine.soundManager.setRadio(url, name);
                    }
                }

                optionsModal.classList.add('hidden');
                this.showMessage('Configuración guardada');
            };
        }

        // Soporte para tecla ESC y O
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Escape' || e.code === 'KeyO') {
                optionsModal.classList.toggle('hidden');
            }
        });
    }

    update(dt, vehicle, scoringSystem, inputManager) {
        const speedKmh = Math.abs(vehicle.speed * 3.6);

        // Velocímetro
        this.speedValue.textContent = speedKmh < 10
            ? speedKmh.toFixed(1)
            : speedKmh.toFixed(0);

        // Aguja (rango -120° a +120°)
        const needleRotation = -120 + (speedKmh / 120) * 240;
        this.speedNeedle.setAttribute('transform', `rotate(${needleRotation} 50 50)`);

        // Volante
        this.visualWheel.style.transform = `rotate(${vehicle.angle * 180}deg)`;

        // Marcha
        if      (vehicle.speed >  0.1) this.gearValue.textContent = 'D';
        else if (vehicle.speed < -0.1) this.gearValue.textContent = 'R';
        else                           this.gearValue.textContent = 'N';

        // Puntaje
        this.scoreValue.textContent = scoringSystem.score;
        this.scoreValue.className   = scoringSystem.score >= 100 ? 'good' : 'bad';

        // Señaleros
        this.blinkTimer += dt;
        const blink = (this.blinkTimer % 0.6) > 0.3;
        this.indLeft.classList.toggle('active',  inputManager.keys.signalLeft  && blink);
        this.indRight.classList.toggle('active', inputManager.keys.signalRight && blink);
    }

    // ── M04 — Actualizar tiempo restante en el HUD ──────────────────────────
        updateTiempoRestante(min, seg) {
        const el = document.getElementById('tiempo-restante');
        if (!el) return;
        const segStr = seg < 10 ? `0${seg}` : `${seg}`;
        el.textContent = `${min}:${segStr}`;

        // Cambiar color a rojo cuando quedan menos de 60 segundos
        el.style.color = (min === 0 && seg <= 60) ? '#ef4444' : '#facc15';
    }

    showMessage(text, isWarning = false) {
        this.systemMessage.innerText     = text;
        this.systemMessage.style.color   = isWarning ? '#ef4444' : '#4ade80';
        this.systemMessage.style.opacity = 1;
        if (this.messageTimeout) clearTimeout(this.messageTimeout);
        this.messageTimeout = setTimeout(() => {
            this.systemMessage.style.opacity = 0;
        }, 3000);
    }

    // ── Pantalla de resumen final ────────────────────────────────────────────
    showSummary(reason, summary) {
        const screen   = document.getElementById('game-over-screen');
        const title    = document.getElementById('game-over-title');
        const reasonEl = document.getElementById('game-over-reason');

        title.textContent    = '🏁 FIN DE LA PRUEBA';
        reasonEl.textContent = reason;

        // Rating
        const ratingEl       = document.getElementById('summary-rating');
        ratingEl.textContent = summary.rating;
        ratingEl.style.color = summary.ratingColor;

        // Stats originales
        document.getElementById('summary-score').textContent    = summary.finalScore;
        document.getElementById('summary-duration').textContent =
            `${summary.durationMin}m ${summary.durationSec}s`;
        document.getElementById('summary-violations-count').textContent  = summary.rulesViolated;
        document.getElementById('summary-compliances-count').textContent = summary.rulesMet;

        // ── M01 — Mostrar conteo de ítems ────────────────────────────────────
      
        const elAciertos  = document.getElementById('summary-aciertos');
        const elErrores   = document.getElementById('summary-errores');
        const elOmisiones = document.getElementById('summary-omisiones');
        if (elAciertos)  elAciertos.textContent  = summary.aciertos  ?? 0;
        if (elErrores)   elErrores.textContent   = summary.errores   ?? 0;
        if (elOmisiones) elOmisiones.textContent = summary.omisiones ?? 0;

        // ── M02 — Mostrar porcentaje de aciertos ─────────────────────────────
        // Fórmula: (aciertos / totalItems) × 100
        const elPorcentaje = document.getElementById('summary-porcentaje');
        if (elPorcentaje) {
            const pct = summary.porcentajeAciertos ?? 0;
            elPorcentaje.textContent = `${pct.toFixed(2)}%`;
            // Color según si aprobó o no
            elPorcentaje.style.color = pct >= 70 ? '#22c55e' : '#ef4444';
        }

        // ── M03 — Mostrar resultado aprobado / no aprobado ───────────────────
        // Se compara porcentajeAciertos con MIN_PASS_PERCENT (70%)
        const elResultado = document.getElementById('summary-resultado');
        if (elResultado) {
            elResultado.textContent = summary.aprobado ? '✅ APROBADO' : '❌ NO APROBADO';
            elResultado.style.color = summary.aprobado ? '#22c55e'    : '#ef4444';
        }

        // ── M06 — Mostrar ID único del intento ───────────────────────────────
        // El ID permite identificar cada partida de forma única
        const elIntentoId   = document.getElementById('summary-intento-id');
        const elFechaInicio = document.getElementById('summary-fecha-inicio');
        const elEstado      = document.getElementById('summary-estado');
        if (elIntentoId)   elIntentoId.textContent   = summary.intentoId   ?? '—';
        if (elFechaInicio) elFechaInicio.textContent  =
            summary.fechaInicio
                ? new Date(summary.fechaInicio).toLocaleString('es-UY')
                : '—';
        if (elEstado)      elEstado.textContent       = summary.estado      ?? '—';

        // ── M15 — Mostrar distancia y rapidez media ──────────────────────────
        // distanciaMetros: metros recorridos durante la prueba
        // rapidezMedia:    promedio de todas las velocidades registradas en km/h
        const elDistancia = document.getElementById('summary-distancia');
        const elRapidez   = document.getElementById('summary-rapidez');
        if (elDistancia) elDistancia.textContent = `${summary.distanciaMetros ?? 0} m`;
        if (elRapidez)   elRapidez.textContent   = `${summary.rapidezMedia   ?? 0} km/h`;

        // Tabla de infracciones
        const tbody = document.getElementById('violations-tbody');
        tbody.innerHTML = '';
        if (summary.violationGroups.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#4ade80">¡Sin infracciones! 🏆</td></tr>';
        } else {
            for (const v of summary.violationGroups) {
                const tr      = document.createElement('tr');
                tr.innerHTML  = `
                    <td>${v.name}</td>
                    <td class="penalty-cell">-${v.penalty} pts${v.count > 1 ? ` ×${v.count}` : ''}</td>
                    <td class="ordinance-cell">${v.ordinance}</td>`;
                tbody.appendChild(tr);
            }
        }

        // Tabla de cumplimientos
        const ctbody = document.getElementById('compliances-tbody');
        ctbody.innerHTML = '';
        if (summary.compliances.length === 0) {
            ctbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#888">Sin cumplimientos registrados</td></tr>';
        } else {
            const seen = new Set();
            for (const c of summary.compliances) {
                if (seen.has(c.ruleId)) continue;
                seen.add(c.ruleId);
                const tr     = document.createElement('tr');
                tr.innerHTML = `
                    <td>${c.name}</td>
                    <td class="reward-cell">+${c.reward} pts</td>`;
                ctbody.appendChild(tr);
            }
        }

        screen.classList.remove('hidden');
    }

    // Mantener compatibilidad si algo llama showGameOver directamente
    showGameOver(reason, finalScore) {
        this.showSummary(reason, {
            finalScore,
            rating:          '—',
            ratingColor:     '#888',
            durationMin:     0,
            durationSec:     0,
            rulesViolated:   0,
            rulesMet:        0,
            violationGroups: [],
            compliances:     [],
            aciertos:        0,
            errores:         0,
            omisiones:       0,
            totalItems:      0,
            porcentajeAciertos: 0,
            aprobado:        false,
            intentoId:       '—',
            fechaInicio:     null,
            estado:          '—',
            distanciaMetros: 0,
            rapidezMedia:    0,
        });
    }
}