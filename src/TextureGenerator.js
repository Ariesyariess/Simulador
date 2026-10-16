import * as THREE from 'three';

export class TextureGenerator {
    // Cache: estas texturas se generaban de nuevo en CADA llamada (una por
    // cada cuadra, por cada cara de cada edificio...). Con decenas de
    // edificios eso son cientos de texturas únicas en la GPU al mismo tiempo,
    // lo que vuelve el juego lento y puede agotar la memoria de video y
    // perder el contexto de WebGL. Ahora se generan una sola vez y se
    // reutiliza la misma textura siempre que se pide.
    static _cache = {};

    static generateNoiseTexture(width, height, baseColor, noiseColor, noiseIntensity = 0.1) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Draw base color
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, width, height);

        // Add noise
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                if (Math.random() < noiseIntensity) {
                    ctx.fillStyle = noiseColor;
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    }

    static getGrassTexture() {
        if (!this._cache.grass) {
            const tex = this.generateNoiseTexture(256, 256, '#3d8c40', '#2d6a2f', 0.15);
            tex.repeat.set(50, 50);
            this._cache.grass = tex;
        }
        return this._cache.grass;
    }

    static getRoadTexture() {
        if (!this._cache.road) {
            const tex = this.generateNoiseTexture(128, 128, '#333333', '#444444', 0.2);
            tex.repeat.set(10, 10);
            this._cache.road = tex;
        }
        return this._cache.road;
    }

    static getSidewalkTexture() {
        if (!this._cache.sidewalk) {
            const tex = this.generateNoiseTexture(128, 128, '#cccccc', '#bbbbbb', 0.1);
            tex.repeat.set(10, 10);
            this._cache.sidewalk = tex;
        }
        return this._cache.sidewalk;
    }

    /** Variante 0..3 para que no todos los edificios tengan EXACTAMENTE
     *  la misma ventana, pero sin generar una textura nueva por edificio. */
    static getBuildingWindowTexture(variant = Math.floor(Math.random() * 4)) {
        const key = `window${variant}`;
        if (this._cache[key]) return this._cache[key];
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // Base building color
        ctx.fillStyle = '#666666';
        ctx.fillRect(0, 0, 256, 256);

        // Draw windows
        const cols = 4;
        const rows = 4;
        const wWidth = 40;
        const wHeight = 50;
        const paddingX = (256 - (cols * wWidth)) / (cols + 1);
        const paddingY = (256 - (rows * wHeight)) / (rows + 1);

        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                // Randomly light up window
                const isLit = Math.random() > 0.6;
                ctx.fillStyle = isLit ? '#ffffaa' : '#111122';
                
                const x = paddingX + i * (wWidth + paddingX);
                const y = paddingY + j * (wHeight + paddingY);
                ctx.fillRect(x, y, wWidth, wHeight);
                
                // Add a window frame
                ctx.strokeStyle = '#222222';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, wWidth, wHeight);
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        this._cache[key] = texture;
        return texture;
    }

    static getSkyTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Gradient sky
        const gradient = ctx.createLinearGradient(0, 0, 0, 512);
        gradient.addColorStop(0, '#1e3a8a'); // Dark blue top
        gradient.addColorStop(0.5, '#3b82f6'); // Mid blue
        gradient.addColorStop(1, '#93c5fd'); // Light blue horizon

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 512);

        // Add some noise/clouds
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        for(let i=0; i<1000; i++) {
            ctx.beginPath();
            ctx.arc(Math.random()*512, Math.random()*256, Math.random()*20, 0, Math.PI*2);
            ctx.fill();
        }

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }
}