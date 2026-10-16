export class InputManager {
    constructor() {
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            signalLeft: false,
            signalRight: false,
            honk: false
        };

        // Estados brutos por fuente para evitar conflictos
        this.keyboard = { forward: false, backward: false, left: false, right: false };
        this.touch = { forward: false, backward: false, left: false, right: false };
        this.gamepad = { forward: false, backward: false, left: false, right: false };
        this.vr = { forward: false, backward: false, left: false, right: false };

        this.initKeyboard();
        this.initTouch();
    }

    initKeyboard() {
        window.addEventListener('keydown', (e) => {
            switch (e.code) {
                case 'KeyW': case 'ArrowUp': this.keyboard.forward = true; break;
                case 'KeyS': case 'ArrowDown': this.keyboard.backward = true; break;
                case 'KeyA': case 'ArrowLeft': this.keyboard.left = true; break;
                case 'KeyD': case 'ArrowRight': this.keyboard.right = true; break;
                case 'KeyQ': 
                    if (this.keys.signalRight) this.keys.signalRight = false;
                    else this.keys.signalLeft = !this.keys.signalLeft;
                    break;
                case 'KeyE': 
                    if (this.keys.signalLeft) this.keys.signalLeft = false;
                    else this.keys.signalRight = !this.keys.signalRight;
                    break;
                case 'KeyR': this.keys.signalLeft = false; this.keys.signalRight = false; break;
                case 'KeyH': this.keys.honk = true; break;
            }
            this.updateConsolidated();
        });

        window.addEventListener('keyup', (e) => {
            switch (e.code) {
                case 'KeyW': case 'ArrowUp': this.keyboard.forward = false; break;
                case 'KeyS': case 'ArrowDown': this.keyboard.backward = false; break;
                case 'KeyA': case 'ArrowLeft': this.keyboard.left = false; break;
                case 'KeyD': case 'ArrowRight': this.keyboard.right = false; break;
            }
            this.updateConsolidated();
        });
    }

    initTouch() {
        const btnLeft = document.getElementById('btn-left');
        const btnRight = document.getElementById('btn-right');
        const btnAccel = document.getElementById('btn-accel');
        const btnBrake = document.getElementById('btn-brake');
        const mSignalL = document.getElementById('mbtn-signal-l');
        const mSignalR = document.getElementById('mbtn-signal-r');
        const btnGear = document.getElementById('btn-gear-toggle');
        const gearVal = document.getElementById('m-gear-val');

        if (!btnLeft) return;

        const setupBtn = (el, type) => {
            if (!el) return;
            const start = (e) => {
                e.preventDefault();
                this.touch[type] = true;
                this.updateConsolidated();
                if (window.audioManagerCtx && window.audioManagerCtx.state === 'suspended') {
                    window.audioManagerCtx.resume();
                }
            };
            const end = (e) => {
                e.preventDefault();
                this.touch[type] = false;
                this.updateConsolidated();
            };
            el.addEventListener('pointerdown', start);
            el.addEventListener('pointerup', end);
            el.addEventListener('pointerleave', end);
            el.addEventListener('contextmenu', e => e.preventDefault());
        };

        setupBtn(btnLeft, 'left');
        setupBtn(btnRight, 'right');
        setupBtn(btnBrake, 'backward');

        if (btnAccel) {
            btnAccel.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                const isReverse = gearVal && gearVal.textContent === 'R';
                if (isReverse) this.touch.backward = true;
                else this.touch.forward = true;
                this.updateConsolidated();
                if (window.audioManagerCtx && window.audioManagerCtx.state === 'suspended') {
                    window.audioManagerCtx.resume();
                }
            });
            const endAccel = (e) => {
                e.preventDefault();
                this.touch.forward = false;
                this.touch.backward = false;
                this.updateConsolidated();
            };
            btnAccel.addEventListener('pointerup', endAccel);
            btnAccel.addEventListener('pointerleave', endAccel);
        }

        if (mSignalL) mSignalL.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            if (this.keys.signalRight) this.keys.signalRight = false;
            else this.keys.signalLeft = !this.keys.signalLeft;
        });
        if (mSignalR) mSignalR.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            if (this.keys.signalLeft) this.keys.signalLeft = false;
            else this.keys.signalRight = !this.keys.signalRight;
        });

        if (btnGear) btnGear.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            const isForward = gearVal.textContent === 'D';
            gearVal.textContent = isForward ? 'R' : 'D';
            btnGear.classList.toggle('reverse', !isForward);
        });
    }

    updateConsolidated() {
        this.keys.forward = this.keyboard.forward || this.touch.forward || this.gamepad.forward || this.vr.forward;
        this.keys.backward = this.keyboard.backward || this.touch.backward || this.gamepad.backward || this.vr.backward;
        this.keys.left = this.keyboard.left || this.touch.left || this.gamepad.left || this.vr.left;
        this.keys.right = this.keyboard.right || this.touch.right || this.gamepad.right || this.vr.right;
    }

    updateGamepad() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = gamepads[0];
        
        if (!gp) {
            this.gamepad = { forward: false, backward: false, left: false, right: false };
            this.updateConsolidated();
            return;
        }

        const deadzone = 0.25;

        // Dirección
        const axisSteer = gp.axes[0];
        if (Math.abs(axisSteer) > deadzone) {
            this.gamepad.left = axisSteer < -deadzone;
            this.gamepad.right = axisSteer > deadzone;
        } else {
            this.gamepad.left = false;
            this.gamepad.right = false;
        }

        // Acelerador y Freno
        let gpAccel = 0;
        if (gp.buttons[7]) gpAccel = gp.buttons[7].value;
        else if (gp.axes[5] !== undefined) gpAccel = Math.max(0, gp.axes[5]);

        let gpBrake = 0;
        if (gp.buttons[6]) gpBrake = gp.buttons[6].value;
        else if (gp.axes[2] !== undefined) gpBrake = Math.max(0, gp.axes[2]);

        this.gamepad.forward = gpAccel > deadzone;
        this.gamepad.backward = gpBrake > deadzone;

        // Señaleros
        if (gp.buttons[4].pressed && !this.prevGpBtn4) {
            if (this.keys.signalRight) this.keys.signalRight = false;
            else this.keys.signalLeft = !this.keys.signalLeft;
        }
        if (gp.buttons[5].pressed && !this.prevGpBtn5) {
            if (this.keys.signalLeft) this.keys.signalLeft = false;
            else this.keys.signalRight = !this.keys.signalRight;
        }
        this.prevGpBtn4 = gp.buttons[4].pressed;
        this.prevGpBtn5 = gp.buttons[5].pressed;

        this.updateConsolidated();
    }
}


