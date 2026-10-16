import * as THREE from 'three';

export class VRManager {
    constructor(sceneManager, gameEngine) {
        this.sceneManager = sceneManager;
        this.gameEngine = gameEngine;
        this.dashboard = null;
        this.isVR = false;

        this.controllers = [];
        this.raycaster = new THREE.Raycaster();
        this.tempMatrix = new THREE.Matrix4();

        this.interactiveObjects = [];
        this.setupControllers();
    }

    setupControllers() {
        const renderer = this.sceneManager.renderer;
        
        for (let i = 0; i < 2; i++) {
            const controller = renderer.xr.getController(i);
            controller.addEventListener('selectstart', (e) => this.onSelectStart(e));
            controller.addEventListener('selectend', (e) => this.onSelectEnd(e));
            this.sceneManager.scene.add(controller);
            this.controllers.push(controller);

            // Rayo visual
            const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
            const line = new THREE.Line(geometry);
            line.name = 'line';
            line.scale.z = 5;
            controller.add(line);
        }
    }

    createDashboard() {
        this.dashboard = new THREE.Group();
        
        // El tablero se sitúa frente a la cámara
        // En VR, la cámara está en (0, 1.6, 0) aprox.
        this.dashboard.position.set(0, -0.4, -0.6); 

        // Base del tablero (clásico, madera/cuero)
        const baseGeom = new THREE.BoxGeometry(1.2, 0.4, 0.3);
        const baseMat = new THREE.MeshLambertMaterial({ color: 0x3d2b1f });
        const base = new THREE.Mesh(baseGeom, baseMat);
        this.dashboard.add(base);

        // Volante
        const wheelGroup = new THREE.Group();
        wheelGroup.position.set(-0.3, 0.1, 0.2);
        wheelGroup.rotation.x = -Math.PI / 4;
        
        const torusGeom = new THREE.TorusGeometry(0.15, 0.02, 12, 24);
        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        this.steeringWheel = new THREE.Mesh(torusGeom, wheelMat);
        wheelGroup.add(this.steeringWheel);
        
        // Rayos del volante
        const spokeGeom = new THREE.BoxGeometry(0.3, 0.02, 0.02);
        const spoke = new THREE.Mesh(spokeGeom, wheelMat);
        this.steeringWheel.add(spoke);

        this.dashboard.add(wheelGroup);

        // Palanca Acelerador (Derecha del volante)
        this.accelLever = this.createLever(0x10b981, "ACCEL");
        this.accelLever.position.set(-0.05, 0.1, 0.15);
        this.dashboard.add(this.accelLever);

        // Palanca Freno (Izquierda del volante)
        this.brakeLever = this.createLever(0xef4444, "BRAKE");
        this.brakeLever.position.set(-0.55, 0.1, 0.15);
        this.dashboard.add(this.brakeLever);

        // Palanca de Cambios (Centro)
        this.gearLever = this.createLever(0x3b82f6, "GEAR");
        this.gearLever.position.set(0.2, 0.1, 0.1);
        this.dashboard.add(this.gearLever);

        // Botones de Giro
        this.btnSignalL = this.createButton(0xf59e0b, "SIG_L");
        this.btnSignalL.position.set(-0.1, 0.25, 0.15);
        this.dashboard.add(this.btnSignalL);

        this.btnSignalR = this.createButton(0xf59e0b, "SIG_R");
        this.btnSignalR.position.set(0.1, 0.25, 0.15);
        this.dashboard.add(this.btnSignalR);

        // No lo añadimos a la escena directamente, sino al cameraGroup del SceneManager
        this.sceneManager.cameraGroup.add(this.dashboard);
        this.dashboard.visible = false;
    }

    createLever(color, name) {
        const group = new THREE.Group();
        group.name = name;
        
        const stickGeom = new THREE.CylinderGeometry(0.01, 0.01, 0.15);
        const stickMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
        const stick = new THREE.Mesh(stickGeom, stickMat);
        stick.position.y = 0.075;
        group.add(stick);

        const knobGeom = new THREE.SphereGeometry(0.03);
        const knobMat = new THREE.MeshLambertMaterial({ color: color });
        const knob = new THREE.Mesh(knobGeom, knobMat);
        knob.position.y = 0.15;
        group.add(knob);

        this.interactiveObjects.push(knob);
        knob.userData = { parentName: name };

        return group;
    }

    createButton(color, name) {
        const geom = new THREE.BoxGeometry(0.06, 0.06, 0.02);
        const mat = new THREE.MeshLambertMaterial({ color: color });
        const btn = new THREE.Mesh(geom, mat);
        btn.name = name;
        btn.userData = { parentName: name };
        this.interactiveObjects.push(btn);
        return btn;
    }

    onSelectStart(event) {
        const controller = event.target;
        this.tempMatrix.identity().extractRotation(controller.matrixWorld);
        this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

        const intersects = this.raycaster.intersectObjects(this.interactiveObjects);
        if (intersects.length > 0) {
            const obj = intersects[0].object;
            const action = obj.userData.parentName;
            this.handleInteraction(action, true);
        }
    }

    onSelectEnd(event) {
        // Al soltar el gatillo, dejamos de acelerar/frenar
        // Para señales y marchas, suele ser un toggle
        const controller = event.target;
        this.tempMatrix.identity().extractRotation(controller.matrixWorld);
        this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

        const intersects = this.raycaster.intersectObjects(this.interactiveObjects);
        if (intersects.length > 0) {
             const action = intersects[0].object.userData.parentName;
             this.handleInteraction(action, false);
        } else {
             // Si soltamos fuera, forzamos release de todo
             this.handleInteraction("ACCEL", false);
             this.handleInteraction("BRAKE", false);
        }
    }

    handleInteraction(action, isDown) {
        const input = this.gameEngine.inputManager;
        switch(action) {
            case "ACCEL":
                input.vr.forward = isDown;
                this.accelLever.rotation.x = isDown ? -0.5 : 0;
                input.updateConsolidated();
                break;
            case "BRAKE":
                input.vr.backward = isDown;
                this.brakeLever.rotation.x = isDown ? -0.5 : 0;
                input.updateConsolidated();
                break;
            case "SIG_L":
                if (isDown) input.keys.signalLeft = !input.keys.signalLeft;
                break;
            case "SIG_R":
                if (isDown) input.keys.signalRight = !input.keys.signalRight;
                break;
            case "GEAR":
                if (isDown) {
                    const vehicle = this.gameEngine.vehicle;
                    // Lógica simple de cambio de marcha
                }
                break;
        }
    }

    update(dt, vehicle) {
        if (!this.dashboard || !this.dashboard.visible) return;

        // Sincronizar volante visual con el ángulo del vehículo
        // El ángulo del vehículo va de aprox -0.6 a 0.6 rad
        this.steeringWheel.rotation.z = -vehicle.angle * 5; 
    }

    toggleVR(active) {
        this.isVR = active;
        if (!this.dashboard) this.createDashboard();
        this.dashboard.visible = active;
        
        // Posicionar al conductor (izquierda en Uruguay/clásicos)
        if (active) {
            this.sceneManager.cameraGroup.position.set(-0.5, 1.2, 0.5); 
        } else {
            this.sceneManager.cameraGroup.position.set(0, 0, 0);
        }
    }
}
