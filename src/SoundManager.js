export class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        window.audioManagerCtx = this.ctx; // Exponer para InputManager
        this.oscillators = [];
        this.gainNodes = [];
        this.filter = null;
        this.isEngineRunning = false;
        this.masterVolume = 0.5;
        this.music = null;
        this.currentSource = 'https://stream.radiopro.uy/listen/estena/estena';
    }

    async startEngine() {
        if (this.isEngineRunning) return;

        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        // Filtro para suavizar el sonido "digital"
        this.filter = this.ctx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 800;
        this.filter.connect(this.ctx.destination);

        const types = ['sawtooth', 'square', 'triangle'];
        const detunes = [-5, 0, 5]; // Desafinación para efecto polifónico

        for (let i = 0; i < 3; i++) {
            const osc = this.ctx.createOscillator();
            osc.type = types[i];
            osc.detune.value = detunes[i];

            const gain = this.ctx.createGain();
            gain.gain.value = 0;

            osc.connect(gain);
            gain.connect(this.filter);

            osc.start();
            this.oscillators.push(osc);
            this.gainNodes.push(gain);
        }

        this.isEngineRunning = true;
        this.startMusic();
    }

    startMusic(source) {
        if (source) {
            this.currentSource = source;
        }

        if (this.music) {
            this.music.pause();
            this.music = null;
        }
        
        const audioPath = this.currentSource;
        console.log("Intentando reproducir audio desde:", audioPath);
        
        this.music = new Audio(audioPath);
        this.music.loop = true;
        this.music.volume = 0.4;
        this.music.crossOrigin = "anonymous"; // Para evitar problemas de CORS si se usa en Web Audio

        this.music.oncanplaythrough = () => {
            console.log("Música cargada y lista para sonar:", audioPath);
            this.music.play().catch(e => console.warn("Fallo al reproducir música:", e));
        };

        this.music.onerror = (e) => {
            console.error("Error al cargar el archivo de audio:", e);
        };
    }

    setRadio(source, name) {
        this.startMusic(source);
        
        // Mostrar overlay estilo GTA
        const overlay = document.getElementById('radio-overlay');
        const nameEl = document.getElementById('radio-name');
        if (overlay && nameEl) {
            nameEl.innerText = name || "RADIO ESPACIO";
            overlay.classList.remove('hidden');
            
            // Ocultar después de 4 segundos
            if (this._radioTimeout) clearTimeout(this._radioTimeout);
            this._radioTimeout = setTimeout(() => {
                overlay.classList.add('hidden');
            }, 4000);
        }
    }

    updateEngine(speedKmh) {
        if (!this.isEngineRunning) {
            this.startEngine();
            return;
        }

        if (!this.filter) return; // Esperar a que el async termine

        const baseFreq = 50 + Math.abs(speedKmh) * 0.8;
        const vol = Math.min(0.01 + Math.abs(speedKmh) * 0.001, 0.08) * this.masterVolume;

        this.oscillators.forEach((osc, i) => {
            // Cada oscilador tiene un múltiplo armónico diferente
            const freq = baseFreq * (i === 1 ? 0.5 : (i === 2 ? 0.25 : 1));
            osc.frequency.value = freq;
        });

        this.gainNodes.forEach(gain => {
            gain.gain.value = vol;
        });

        // El filtro se abre un poco al acelerar
        this.filter.frequency.value = 800 + Math.abs(speedKmh) * 10;
    }

    playCrash() {
        // White noise burst for crash
        const bufferSize = this.ctx.sampleRate * 1.5; // 1.5 seconds
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.2)); // decay
        }

        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;

        const gain = this.ctx.createGain();
        gain.gain.value = 0.5 * this.masterVolume;

        noiseSource.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        noiseSource.start();
    }

    playHonk() {
        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 400; // Car horn pitch

        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sawtooth';
        osc2.frequency.value = 415; // Dissonance for realism

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.3 * this.masterVolume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc2.start();
        osc.stop(this.ctx.currentTime + 0.4);
        osc2.stop(this.ctx.currentTime + 0.4);
    }
}
