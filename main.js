import { GameEngine } from './src/GameEngine.js';

window.addEventListener('DOMContentLoaded', () => {
    const engine = new GameEngine();

    const startScreen = document.getElementById('start-screen');
    const btnStart = document.getElementById('btn-start');
    const btnRestart = document.getElementById('btn-restart');

    btnStart.addEventListener('click', () => {
        startScreen.classList.add('hidden');
        engine.start();
    });

    btnRestart.addEventListener('click', () => {
        // Reload page for full clean restart for now
        window.location.reload();
    });
});
