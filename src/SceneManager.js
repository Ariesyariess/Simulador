import * as THREE from 'three';
console.log('[VeloX] SceneManager.js v8 cargado');
import { TextureGenerator } from './TextureGenerator.js';
import { CONSTANTS } from './Constants.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

export class SceneManager {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.canvas, 
            antialias: CONSTANTS.QUALITY !== 'low' 
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        if (CONSTANTS.QUALITY === 'low') {
            this.renderer.shadowMap.enabled = false;
            this.renderer.setPixelRatio(1);
        } else {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        }

        this.renderer.xr.enabled = true;
        document.body.appendChild(VRButton.createButton(this.renderer));

        this.scene = new THREE.Scene();
        this.scene.background = TextureGenerator.getSkyTexture();
        this.scene.fog = new THREE.Fog(0x87CEEB, 50, 300);

        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
        

        this.cameraGroup = new THREE.Group();
        this.cameraGroup.add(this.camera);
        this.scene.add(this.cameraGroup);
        
        // Parámetros de vista panorámica mejorados
        this.cameraRotation = { 
            yaw: Math.PI, 
            pitch: 0.3 
        };
        this.cameraInitialized = false;
        this.isPointerDown = false;
        this.lastPointerPos = { x: 0, y: 0 };
        
        this.firstPerson = false;
        this.fpYaw = 0;   
        this.fpPitch = 0; 

        this.setupLights();
        this.setupEvents();
    }

    // Botón en pantalla (sirve en celular/tablet, donde no hay tecla C)
    createViewButton() {
        const btn = document.createElement('button');
        btn.id = 'btn-view-toggle';
        btn.textContent = '👁 Vista interior (C)';
        Object.assign(btn.style, {
            position: 'fixed', top: '12px', right: '12px', zIndex: 20,
            padding: '8px 14px', font: '600 14px system-ui, sans-serif',
            color: '#fff', background: 'rgba(20,35,70,0.85)',
            border: '1px solid #c0c5ca', borderRadius: '8px', cursor: 'pointer'
        });
        btn.addEventListener('click', (e) => { e.stopPropagation(); this.toggleFirstPerson(); });
        btn.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
        document.body.appendChild(btn);
        this.viewButton = btn;
    }

    // Tecla C: entra a la vista en primera persona (dentro del auto). C otra vez: sale.
    toggleFirstPerson() {
        this.firstPerson = !this.firstPerson;
        if (this.firstPerson) {
            this.fpYaw = 0;
            this.fpPitch = 0.08;
            this.camera.near = 0.05;
            this.camera.fov = 74;
        } else {
            this.camera.near = 0.1;
            this.camera.fov = 70;
        }
        this.camera.updateProjectionMatrix();
        if (this.viewButton) this.viewButton.textContent = this.firstPerson ? '🚗 Salir del auto (C)' : 'Vista interior (C)';
    }

    setupEvents() {
        window.addEventListener('resize', () => this.onWindowResize(), false);

        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyC' && !e.repeat) this.toggleFirstPerson();
        });

        this.createViewButton();

        this.canvas.addEventListener('contextmenu', e => e.preventDefault());

        const onPointerDown = (x, y) => {
            this.isPointerDown = true;
            this.lastPointerPos = { x, y };
        };

        const onPointerMove = (x, y) => {
            if (!this.isPointerDown) return;
            const dx = x - this.lastPointerPos.x;
            const dy = y - this.lastPointerPos.y;

            if (this.firstPerson) {
              
                this.fpYaw   = Math.max(-2.2, Math.min(2.2, this.fpYaw - dx * 0.007));
                this.fpPitch = Math.max(-0.6, Math.min(0.6, this.fpPitch + dy * 0.007));
            } else {
                this.cameraRotation.yaw -= dx * 0.007;
                this.cameraRotation.pitch = Math.max(-0.2, Math.min(Math.PI / 2.2, this.cameraRotation.pitch + dy * 0.007));
            }

            this.lastPointerPos = { x, y };
        };

        const onPointerUp = () => {
            this.isPointerDown = false;
        };

        // Mouse
        this.canvas.addEventListener('mousedown', e => onPointerDown(e.clientX, e.clientY));
        window.addEventListener('mousemove', e => onPointerMove(e.clientX, e.clientY));
        window.addEventListener('mouseup', onPointerUp);

        // Touch
        this.canvas.addEventListener('touchstart', e => {
            onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });
        window.addEventListener('touchmove', e => {
            onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });
        window.addEventListener('touchend', onPointerUp);
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(100, 200, 50);
        dirLight.castShadow = true;
        this.scene.add(dirLight);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    updateCamera(vehicleMesh) {
        if (this.firstPerson && !this.renderer.xr.isPresenting) {
            vehicleMesh.updateMatrixWorld(true);
            this.cameraGroup.updateMatrixWorld(true);

            // Posición de los ojos (viene de VehicleController.js)
            const eyeLocal = vehicleMesh.userData.eye || new THREE.Vector3(-0.40, 0.70, -0.05);
            const worldEye = vehicleMesh.localToWorld(eyeLocal.clone());

            // Rotación del auto 
            const vehicleQuaternion = new THREE.Quaternion();
            vehicleMesh.getWorldQuaternion(vehicleQuaternion);

            // Dirección de mirada: frente del auto + mouse 
            const forwardLocal = new THREE.Vector3(0, 0, 1);
            const lookRotation = new THREE.Euler(this.fpPitch, this.fpYaw, 0, 'YXZ');
            forwardLocal.applyEuler(lookRotation);
            forwardLocal.applyQuaternion(vehicleQuaternion);
            const worldTarget = worldEye.clone().add(forwardLocal);

            // Pasar a coordenadas locales del cameraGroup y aplicar
            this.camera.position.copy(this.cameraGroup.worldToLocal(worldEye));
            this.camera.lookAt(this.cameraGroup.worldToLocal(worldTarget));
            return;
        }

        const distance = 6;
        
        const vehicleYaw = vehicleMesh.rotation.y;
        const totalYaw = this.cameraRotation.yaw + vehicleYaw;
        
        const x = Math.sin(totalYaw) * Math.cos(this.cameraRotation.pitch) * distance;
        const y = Math.sin(this.cameraRotation.pitch) * distance + 1.5; // Offset de altura
        const z = Math.cos(totalYaw) * Math.cos(this.cameraRotation.pitch) * distance;
        
        const targetPos = vehicleMesh.position.clone().add(new THREE.Vector3(x, y, z));
        
        if (!this.renderer.xr.isPresenting) {
            if (this.cameraInitialized) {
                this.camera.position.lerp(targetPos, 0.15);
            } else {
                this.camera.position.copy(targetPos);
                this.cameraInitialized = true;
            }
            
            const lookAtPos = vehicleMesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
            this.camera.lookAt(lookAtPos);
        }
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}