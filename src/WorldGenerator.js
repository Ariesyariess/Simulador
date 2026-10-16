import * as THREE from 'three';
import { CONSTANTS } from './Constants.js';
import { TextureGenerator } from './TextureGenerator.js';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class WorldGenerator {
    constructor(scene, trafficSystem, pedestrianSystem) {
        this.scene = scene;
        this.trafficSystem = trafficSystem;
        this.pedestrianSystem = pedestrianSystem;
        
        this.loader = new GLTFLoader();
        this.buildingTemplates = [];
        this.loadBuildingModels();

        this.flags = [];
        this.schoolSignBox = null;
        this.yieldZones   = [];
        this.stopZones    = [];
        this.speedZones   = [];
        this.roadBoxes    = [];
        this.inspectors   = [];
        this.buildingBoxes = [];
        this.oneWayZones  = []; 
    }

    loadBuildingModels() {
        const models = [
            'abandoned_building.glb',
            'asia_building.glb',
            'building_06.glb',
            'building_08.glb',
            'futuristic_building.glb',
            'low_poly_building.glb',
            'warehouse_building.glb'
        ];

        this.parkingZones = [];
        this.readyPromise = Promise.all(models.map(m => {
            return new Promise(resolve => {
                this.loader.load(`./models/buildings/${m}`, (gltf) => {
                    const model = gltf.scene;
                    model.traverse(node => {
                        if (node.isMesh) {
                            node.castShadow = true;
                            node.receiveShadow = true;
                        }
                    });
                    const box = new THREE.Box3().setFromObject(model);
                    const size = box.getSize(new THREE.Vector3());
                    this.buildingTemplates.push({ model, size });
                    resolve();
                }, undefined, () => resolve()); // Resolver aunque falle para no bloquear
            });
        }));
    }

    async generateCity(gridSize = 3) {
        // Esperamos a que los modelos carguen para que createBlock los use
        await this.readyPromise;

        const blockSize = CONSTANTS.BLOCK_SIZE;
        const roadWidth = CONSTANTS.ROAD_WIDTH;
        const totalSize = blockSize + roadWidth;

        // Suelo base (Pasto)
        const groundGeom = new THREE.PlaneGeometry(totalSize * gridSize * 2.5, totalSize * gridSize * 2.5);
        const groundMat = new THREE.MeshLambertMaterial({ 
            color: 0xffffff, 
            map: TextureGenerator.getGrassTexture() 
        });
        const ground = new THREE.Mesh(groundGeom, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        this._oneWayRows = new Set();

        for (let i = -gridSize; i <= gridSize; i++) {
            for (let j = -gridSize; j <= gridSize; j++) {
                const centerX = i * totalSize;
                const centerZ = j * totalSize;

                const isAvenue = j === 0;
                const hWidth = isAvenue ? roadWidth * 1.5 : roadWidth;
                const vWidth = roadWidth;

                // Calles
                this.createRoad(centerX, centerZ + blockSize / 2 + vWidth / 2, blockSize + vWidth, hWidth, true);
                this.createRoad(centerX + blockSize / 2 + hWidth / 2, centerZ, vWidth, blockSize + hWidth, false);

                // Intersecciones
                if (i !== gridSize && j !== gridSize) {
                    const interX = centerX + blockSize / 2 + hWidth / 2;
                    const interZ = centerZ + blockSize / 2 + vWidth / 2;

                    if (isAvenue) {
                        if (Math.random() < 0.8) { // Más rotondas en avenidas
                            this.createRoundabout(interX, interZ, true);
                        } else {
                            this.trafficSystem.addIntersection(interX, interZ);
                            const stopSideX = vWidth / 2 + 6;
                            const stopSideZ = hWidth / 2 + 6;
                            this.createStopSign(interX + stopSideX, 0, interZ + stopSideZ, 0); 
                            this.createStopSign(interX - stopSideX, 0, interZ - stopSideZ, Math.PI);
                        }
                    } else {
                        const isNearSpawn = (i === 0 && j === -1) || (i === 1 && j === -1);
                        if (!isNearSpawn && Math.random() < 0.4) { // Más rotondas en calles
                            this.createRoundabout(interX, interZ, false);
                        } else {
                            this.trafficSystem.addIntersection(interX, interZ);
                        }
                    }
                }

                // Cuadra
                if (i === 0 && j === 1) {
                    this.createSchoolBlock(centerX, centerZ);
                } else if (i === 1 && j === -1) {
                    this.createParkingLot(centerX, centerZ);
                } else {
                    this.createBlock(centerX, centerZ);
                }

                // Señales de Velocidad con ROTACIÓN CORRECTA (mirando al tránsito)
                if (i < gridSize && j < gridSize) {
                    const signX = centerX + blockSize / 2 - 2; 
                    const signZ = centerZ + blockSize / 2 - 2;
                    
                    if (!isAvenue && Math.abs(i) % 2 === 0) {
                        // Calle vertical (N-S). El tráfico viene desde +Z o -Z.
                        // Colocamos señal para los que van hacia el Norte (-Z). Mira al Sur (+Z) -> 0
                        this.createSpeedSign(signX, 0, signZ, 45, 0); 
                    } else if (isAvenue) {
                        // Avenida horizontal (E-W). El tráfico viene desde +X o -X.
                        // Mira hacia el Oeste (+X) para los que vienen del Este. -> PI/2
                        this.createSpeedSign(signX, 0, signZ, 75, Math.PI / 2);
                    } else {
                        // En otras calles, poner cartel de Prohibido Adelantar
                        this.createNoOvertakeSign(signX, 0, signZ, 0);
                    }
                }

                // Cebra, Inspectores y Faroles en intersecciones
                if (i < gridSize && j < gridSize) {
                    const interX = centerX + blockSize / 2 + hWidth / 2;
                    const interZ = centerZ + blockSize / 2 + vWidth / 2;

                    // Cebra
                    if (!isAvenue || Math.random() < 0.3) {
                        this.createCrosswalk(interX, interZ + hWidth / 2 + 2);
                        this.pedestrianSystem.spawnAt(interX - 6, interZ + hWidth/2, 0, 1, hWidth);
                    }

                    // Inspectores y Faroles
                    if (Math.random() < 0.25) {
                        this.createTrafficInspector(interX + vWidth/2 + 1.5, interZ + hWidth/2 + 1.5, Math.PI + Math.PI/4);
                        this.createStreetLamp(interX + vWidth/2 + 2, 0, interZ + hWidth/2 + 2);
                        this.createStreetLamp(interX - vWidth/2 - 2, 0, interZ + hWidth/2 + 2);
                    }
                }
            }
        }

        // ── Calles de un solo sentido (E-W, no avenida) ──────────────────────
        // j=-2 y j=2 → Sentido Este (+X)
        // j=-1 y j=1 → Sentido Oeste (-X)
        const vWidth = roadWidth; // ancho de calles N-S (siempre roadWidth)
        const oneWayConfig = [
            { j: -2, dirX: 1,  label: '→ CALLE 1 SENTIDO' },
            { j: -1, dirX: -1, label: '← CALLE 1 SENTIDO' },
            { j:  1, dirX: 1,  label: '→ CALLE 1 SENTIDO' },
            { j:  2, dirX: -1, label: '← CALLE 1 SENTIDO' },
        ];

        for (const cfg of oneWayConfig) {
            const roadZ  = cfg.j * totalSize + blockSize / 2 + vWidth / 2;
            // Solo calles normales (no avenida)
            if (cfg.j === 0) continue;

            for (let i = -gridSize; i < gridSize; i++) {
                const startX = i * totalSize;
                const endX   = (i + 1) * totalSize;
                const midX   = (startX + endX) / 2;

                // ① Flechas pintadas en el asfalto (cada 25 unidades)
                for (let ax = startX + 12; ax < endX - 12; ax += 25) {
                    this.createRoadArrow(ax, roadZ, cfg.dirX);
                }

                // ② Cartel de sentido único en la vereda (inicio del tramo)
                const signX = cfg.dirX > 0 ? startX + 4 : endX - 4;
                const signZ = roadZ - vWidth / 2 - 2; // vereda sur
                this.createOneWaySign(signX, signZ, cfg.dirX);

                // ③ Cartel CONTRAMANO en la cara opuesta (entrada prohibida)
                const wrongX = cfg.dirX > 0 ? endX - 3 : startX + 3;
                const wrongZ = roadZ - vWidth / 2 - 2;
                this.createWrongWaySign(wrongX, wrongZ, cfg.dirX);
            }

            // Registrar zona de sentido único para penalización
            const rowRoadZ = cfg.j * totalSize + blockSize / 2 + vWidth / 2;
            this.oneWayZones.push({
                box: new THREE.Box3().setFromCenterAndSize(
                    new THREE.Vector3(0, 2, rowRoadZ),
                    new THREE.Vector3(totalSize * gridSize * 2, 6, vWidth)
                ),
                dirX: cfg.dirX,
                dirZ: 0,
            });
        }
    }

    createRoad(x, z, width, length, isHorizontal) {
        const roadGeom = new THREE.PlaneGeometry(width, length);
        const roadMat  = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            map:   TextureGenerator.getRoadTexture()
        });
        const road = new THREE.Mesh(roadGeom, roadMat);
        road.rotation.x = -Math.PI / 2;
        road.position.set(x, 0.01, z);
        road.receiveShadow = true;
        this.scene.add(road);

        this.roadBoxes.push(new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(x, 1, z),
            new THREE.Vector3(width + 2, 4, length + 2)
        ));

        // Líneas punteadas alineadas a coordenadas MUNDIALES
        // Así los dashes de cuadras adyacentes quedan continuos sin huecos
        const segLen   = 4;
        const segGap   = 4;
        const cycle    = segLen + segGap;           // 8 unidades por ciclo
        const lineMat  = new THREE.MeshBasicMaterial({ color: 0xffffff });

        if (isHorizontal) {
            // Recorre el eje X usando coords mundiales
            const worldStart = x - width / 2;
            const worldEnd   = x + width / 2;
            // Primer dash alineado al grid global
            let pos = Math.ceil(worldStart / cycle) * cycle;
            while (pos + segLen / 2 < worldEnd) {
                const segGeom = new THREE.PlaneGeometry(segLen, 0.25);
                const seg = new THREE.Mesh(segGeom, lineMat);
                seg.rotation.x = -Math.PI / 2;
                seg.position.set(pos + segLen / 2, 0.02, z);
                this.scene.add(seg);
                pos += cycle;
            }
        } else {
            // Recorre el eje Z usando coords mundiales
            const worldStart = z - length / 2;
            const worldEnd   = z + length / 2;
            let pos = Math.ceil(worldStart / cycle) * cycle;
            while (pos + segLen / 2 < worldEnd) {
                const segGeom = new THREE.PlaneGeometry(0.25, segLen);
                const seg = new THREE.Mesh(segGeom, lineMat);
                seg.rotation.x = -Math.PI / 2;
                seg.position.set(x, 0.02, pos + segLen / 2);
                this.scene.add(seg);
                pos += cycle;
            }
        }
    }

    createBlock(x, z) {
        const size = CONSTANTS.BLOCK_SIZE;
        const sw = CONSTANTS.SIDEWALK_WIDTH;

        // Vereda
        const sidewalkGeom = new THREE.PlaneGeometry(size, size);
        const sidewalkMat = new THREE.MeshLambertMaterial({ 
            color: 0xffffff,
            map: TextureGenerator.getSidewalkTexture()
        });
        const sidewalk = new THREE.Mesh(sidewalkGeom, sidewalkMat);
        sidewalk.rotation.x = -Math.PI / 2;
        sidewalk.position.set(x, 0.03, z);
        sidewalk.receiveShadow = true;
        this.scene.add(sidewalk);

        // Guardar también la vereda y edificios como zona segura de calzada? 
        // No, el offroad será "todo lo que no sea roadBoxes".
        
        // Agregar árboles en los bordes
        for (let i = 0; i < 4; i++) {
            if (Math.random() > 0.3) {
                const tx = x - size/2 + sw + Math.random() * (size - sw * 2);
                const tz = z - size/2 + sw/2; // Borde superior
                this.createTree(tx, 0, tz);
            }
        }

        // Edificios
        const numBuildings = 4;
        const bSize = (size - sw * 2) / 2;
        
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 2; j++) {
                if (Math.random() > 0.15) { // 85% chance de edificio
                    const bx = x - size/2 + sw + bSize/2 + i * bSize;
                    const bz = z - size/2 + sw + bSize/2 + j * bSize;

                    // ¿Usamos un modelo 3D o un cubo?
                    const isLow = CONSTANTS.QUALITY === 'low';
                    if (!isLow && this.buildingTemplates.length > 0 && Math.random() < 0.6) {
                        const template = this.buildingTemplates[Math.floor(Math.random() * this.buildingTemplates.length)];
                        const b = template.model.clone();
                        
                        const scale = (bSize - 4) / Math.max(template.size.x, template.size.z);
                        b.scale.set(scale, scale, scale);
                        b.position.set(bx, 0, bz);
                        this.scene.add(b);
                        this.buildingBoxes.push(new THREE.Box3().setFromObject(b));
                    } else {
                        const height = isLow ? 15 : 10 + Math.random() * 40;
                        const bGeom = new THREE.BoxGeometry(bSize - 2, height, bSize - 2);
                        const color = CONSTANTS.COLOR_BUILDING[Math.floor(Math.random() * CONSTANTS.COLOR_BUILDING.length)];
                        
                        let bMat;
                        if (isLow) {
                            bMat = new THREE.MeshLambertMaterial({ color: color });
                        } else {
                            bMat = [
                                new THREE.MeshLambertMaterial({ color: color, map: TextureGenerator.getBuildingWindowTexture() }),
                                new THREE.MeshLambertMaterial({ color: color, map: TextureGenerator.getBuildingWindowTexture() }),
                                new THREE.MeshLambertMaterial({ color: color }), 
                                new THREE.MeshLambertMaterial({ color: color }),
                                new THREE.MeshLambertMaterial({ color: color, map: TextureGenerator.getBuildingWindowTexture() }),
                                new THREE.MeshLambertMaterial({ color: color, map: TextureGenerator.getBuildingWindowTexture() })
                            ];
                        }
                        const b = new THREE.Mesh(bGeom, bMat);
                        b.position.set(bx, height/2, bz);
                        if (!isLow) {
                            b.castShadow = true;
                            b.receiveShadow = true;
                        }
                        this.scene.add(b);
                        this.buildingBoxes.push(new THREE.Box3().setFromObject(b));
                    }
                }
            }
        }

        // Añadir peatones caminando por la vereda al azar
        for (let i=0; i<2; i++) {
            const rx = x - size/2 + sw/2 + Math.random() * (size - sw);
            const rz = z - size/2 + sw/2 + Math.random() * (size - sw);
            // Hacerlos caminar por el borde de la vereda
            const dirX = Math.random() > 0.5 ? 1 : 0;
            const dirZ = dirX === 1 ? 0 : 1;
            this.pedestrianSystem.spawnAt(rx, rz, dirX, dirZ, size/2);
        }
    }

    createSchoolBlock(x, z) {
        const size = CONSTANTS.BLOCK_SIZE;
        const sw   = CONSTANTS.SIDEWALK_WIDTH;

        const sidewalkGeom = new THREE.PlaneGeometry(size, size);
        const sidewalkMat  = new THREE.MeshLambertMaterial({ color: CONSTANTS.COLOR_SIDEWALK });
        const sidewalk = new THREE.Mesh(sidewalkGeom, sidewalkMat);
        sidewalk.rotation.x = -Math.PI / 2;
        sidewalk.position.set(x, 0.03, z);
        sidewalk.receiveShadow = true;
        this.scene.add(sidewalk);

        const bSize = size - sw * 2 - 4;
        const height = 15;
        const schoolGeom = new THREE.BoxGeometry(bSize, height, bSize);
        const schoolMat  = new THREE.MeshLambertMaterial({ color: CONSTANTS.COLOR_SCHOOL });
        const school = new THREE.Mesh(schoolGeom, schoolMat);
        school.position.set(x, height / 2, z);
        school.castShadow = true;
        school.receiveShadow = true;
        this.scene.add(school);
        this.buildingBoxes.push(new THREE.Box3().setFromObject(school));

        this.createSign(x, height, z + bSize / 2 + 0.1, 'ESCUELA');
        this.createUruguayFlag(x, height, z + bSize / 2);

        // Cartel ZONA ESCOLAR en la vereda
        const signX = x - 10;
        const signZ = z + size / 2 + 2;
        this.createSignpost(signX, 0, signZ);
        this.createCrosswalk(x, signZ);

        // Zona escolar 30 km/h (con flag inSchoolZone para RULE_22)
        this.schoolSignBox = new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(x, 2, z),
            new THREE.Vector3(size + 40, 10, size + 40)
        );
        this.speedZones.push({
            box: this.schoolSignBox,
            limit: CONSTANTS.SCHOOL_SPEED_LIMIT,
            inSchoolZone: true
        });
    }

    createSignpost(x, y, z) {
        // Poste
        const poleGeom = new THREE.CylinderGeometry(0.1, 0.1, 3);
        const poleMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
        const pole = new THREE.Mesh(poleGeom, poleMat);
        pole.position.set(x, y + 1.5, z);
        this.scene.add(pole);

        // Cartel amarillo
        const signGeom = new THREE.PlaneGeometry(2, 2);
        // Usar canvas para pintar "ESCUELA"
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#facc15'; // Amarillo
        ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = 'black';
        ctx.font = 'bold 40px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ZONA', 128, 100);
        ctx.fillText('ESCOLAR', 128, 150);
        ctx.font = 'bold 30px sans-serif';
        ctx.fillText('MAX 30', 128, 200);

        const tex = new THREE.CanvasTexture(canvas);
        const signMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
        const sign = new THREE.Mesh(signGeom, signMat);
        sign.position.set(x, y + 3, z);
        // Rotar para que se vea desde la calle
        sign.rotation.y = -Math.PI / 2;
        this.scene.add(sign);
    }

    createYieldSign(x, y, z, rotationY) {
        // Poste
        const poleGeom = new THREE.CylinderGeometry(0.1, 0.1, 3);
        const poleMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
        const pole = new THREE.Mesh(poleGeom, poleMat);
        pole.position.set(x, y + 1.5, z);
        this.scene.add(pole);

        const group = new THREE.Group();
        group.position.set(x, y + 3.5, z);
        group.rotation.y = rotationY;
        this.scene.add(group);

        // Ceda el Paso: Triángulo (Cilindro de 3 lados)
        const signGeom = new THREE.CylinderGeometry(1.4, 1.4, 0.1, 3);
        const signMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const sign = new THREE.Mesh(signGeom, signMat);
        
        // Cara frontal (+Z local del grupo)
        sign.rotation.set(Math.PI / 2, 0, 0);
        group.add(sign);
        
        // Triangulo blanco interior
        const innerShape = new THREE.Shape();
        innerShape.moveTo(0, -0.6);
        innerShape.lineTo(0.7, 0.6);
        innerShape.lineTo(-0.7, 0.6);
        innerShape.closePath();
        const innerGeom = new THREE.ShapeGeometry(innerShape);
        const innerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const inner = new THREE.Mesh(innerGeom, innerMat);
        inner.position.z = 0.06;
        sign.add(inner);
    }

    createStopSign(x, y, z, rotationY) {
        const poleGeom = new THREE.CylinderGeometry(0.1, 0.1, 3);
        const poleMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
        const pole = new THREE.Mesh(poleGeom, poleMat);
        pole.position.set(x, y + 1.5, z);
        this.scene.add(pole);

        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // Dibujar el octágono rojo
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        const cx = 128, cy = 128, r_draw = 120;
        for (let i = 0; i < 8; i++) {
            const ang = (i * Math.PI / 4) + Math.PI / 8;
            if (i === 0) ctx.moveTo(cx + Math.cos(ang) * r_draw, cy + Math.sin(ang) * r_draw);
            else ctx.lineTo(cx + Math.cos(ang) * r_draw, cy + Math.sin(ang) * r_draw);
        }
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.font = 'bold 65px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PARE', 128, 128);

        const group = new THREE.Group();
        group.position.set(x, y + 3.5, z);
        group.rotation.y = rotationY;
        this.scene.add(group);

        // PARE: Octágono (Cuerpo físico)
        const isLow = CONSTANTS.QUALITY === 'low';
        const signGeom = new THREE.CylinderGeometry(1.3, 1.3, 0.1, 8);
        const signMat = new THREE.MeshLambertMaterial({ color: 0xef4444 });
        const sign = new THREE.Mesh(signGeom, signMat);
        sign.rotation.x = Math.PI / 2;
        group.add(sign);

        // Cara frontal con texto
        const tex = new THREE.CanvasTexture(canvas);
        // Usar CircleGeometry con 8 lados para que coincida con el octágono
        const faceGeom = new THREE.CircleGeometry(1.28, 8);
        const faceMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
        const face = new THREE.Mesh(faceGeom, faceMat);
        face.position.z = 0.06;
        face.rotation.z = Math.PI / 8; // Alinear con el cilindro
        group.add(face);

        // Añadir zona
        this.stopZones.push({
            box: new THREE.Box3().setFromCenterAndSize(
                new THREE.Vector3(x, 2, z),
                new THREE.Vector3(15, 10, 15) // Zona amplia para detectar parada
            ),
            completed: false
        });
    }

    createRoundabout(x, z, isAvenue) {
        // Centro de la rotonda (Pasto)
        // Reducir el radio significativamente para que los autos puedan circular
        const radius = isAvenue ? 6 : 4; 
        const centerGeom = new THREE.CylinderGeometry(radius - 0.5, radius - 0.5, 0.2, 32);
        const centerMat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: TextureGenerator.getGrassTexture() });
        const center = new THREE.Mesh(centerGeom, centerMat);
        center.position.set(x, 0.1, z);
        this.scene.add(center);

        // Árbol en el medio
        this.createTree(x, 0.2, z);

        // Cordón
        const borderGeom = new THREE.TorusGeometry(radius - 0.5, 0.2, 8, 32);
        const borderMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
        const border = new THREE.Mesh(borderGeom, borderMat);
        border.rotation.x = Math.PI / 2;
        border.position.set(x, 0.1, z);
        this.scene.add(border);

        // Añadir señales de ceda el paso en las entradas (A petición, limitamos a 2 carteles para no saturar)
        const cornerX = CONSTANTS.ROAD_WIDTH / 2 + 1;
        const cornerZ = isAvenue ? (CONSTANTS.ROAD_WIDTH * 1.5 / 2 + 1) : cornerX;

        // Sur entrando (vienen desde +Z): El cartel debe mirar hacia el Sur (+Z) -> 0
        this.createYieldSign(x + cornerX, 0, z + cornerZ, 0);

        // Norte entrando (vienen desde -Z): El cartel debe mirar hacia el Norte (-Z) -> PI
        this.createYieldSign(x - cornerX, 0, z - cornerZ, Math.PI);

        // Este entrando (vienen desde +X): El cartel debe mirar hacia el Este (+X) -> PI/2
        this.createYieldSign(x + cornerZ, 0, z - cornerX, Math.PI / 2);

        // Oeste entrando (vienen desde -X): El cartel debe mirar hacia el Oeste (-X) -> -PI/2
        this.createYieldSign(x - cornerZ, 0, z + cornerX, -Math.PI / 2);

        // Guardar zona de ceda el paso para penalizaciones
        this.yieldZones.push(new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(x, 2, z),
            new THREE.Vector3(CONSTANTS.INTERSECTION_SIZE * 1.5, 10, CONSTANTS.INTERSECTION_SIZE * 1.5)
        ));
    }

    createSign(x, y, z, text) {
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 512, 128);
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 10;
        ctx.strokeRect(0, 0, 512, 128);
        ctx.fillStyle = 'black';
        ctx.font = 'bold 60px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(text, 256, 85);

        const tex = new THREE.CanvasTexture(canvas);
        const signMat = new THREE.MeshBasicMaterial({ map: tex });
        const signGeom = new THREE.PlaneGeometry(8, 2);
        const sign = new THREE.Mesh(signGeom, signMat);
        sign.position.set(x, y - 2, z);
        this.scene.add(sign);
    }

    createCrosswalk(x, z) {
        const numStripes = 8;
        const stripeW    = 0.8;
        const stripeL    = CONSTANTS.ROAD_WIDTH;
        const startX     = x - (numStripes * (stripeW + 0.5)) / 2;

        for (let i = 0; i < numStripes; i++) {
            const geom  = new THREE.PlaneGeometry(stripeW, stripeL);
            const mat   = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const stripe = new THREE.Mesh(geom, mat);
            stripe.rotation.x = -Math.PI / 2;
            stripe.rotation.z =  Math.PI / 2;
            stripe.position.set(startX + i * (stripeW + 0.5), 0.05, z);
            this.scene.add(stripe);
        }
    }

    // Farol de calle
    createStreetLamp(x, y, z) {
        const poleGeom = new THREE.CylinderGeometry(0.08, 0.12, 6, 6);
        const poleMat  = new THREE.MeshLambertMaterial({ color: 0x555555 });
        const pole     = new THREE.Mesh(poleGeom, poleMat);
        pole.position.set(x, y + 3, z);
        this.scene.add(pole);

        // Luminaria
        const lampGeom = new THREE.SphereGeometry(0.25, 8, 6);
        const lampMat  = new THREE.MeshBasicMaterial({ color: 0xffffcc });
        const lamp     = new THREE.Mesh(lampGeom, lampMat);
        lamp.position.set(x, y + 6.2, z);
        this.scene.add(lamp);
    }

    createUruguayFlag(x, y, z) {
        // Mástil
        const poleGeom = new THREE.CylinderGeometry(0.1, 0.1, 10);
        const poleMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const pole = new THREE.Mesh(poleGeom, poleMat);
        pole.position.set(x - 5, y + 5, z);
        this.scene.add(pole);

        // Textura bandera (Canvas procedural simple)
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 341;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 512, 341);
        ctx.fillStyle = '#0038a8'; // Azul bandera
        for (let i = 1; i <= 9; i+=2) {
            ctx.fillRect(0, i * 341/9, 512, 341/9);
        }
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 200, 4 * 341/9);
        ctx.fillStyle = '#fcd116'; // Sol de Mayo (simple circle)
        ctx.beginPath();
        ctx.arc(100, 2 * 341/9, 40, 0, Math.PI * 2);
        ctx.fill();

        const tex = new THREE.CanvasTexture(canvas);
        
        // Geometría con segmentos para ondear
        const flagGeom = new THREE.PlaneGeometry(4, 2.5, 20, 10);
        const flagMat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide });
        const flag = new THREE.Mesh(flagGeom, flagMat);
        
        // Posicionar top left pegado al mástil
        flag.position.set(x - 3, y + 8.5, z);
        this.scene.add(flag);

        // Guardar vertices originales y mesh para animar
        const positions = flagGeom.attributes.position;
        const initialZ = [];
        for (let i = 0; i < positions.count; i++) {
            initialZ.push(positions.getZ(i));
        }

        this.flags.push({ mesh: flag, initialZ, time: 0 });
    }

    createTree(x, y, z) {
        const group = new THREE.Group();
        const isLow = CONSTANTS.QUALITY === 'low';
        
        // Tronco
        const trunkGeom = new THREE.CylinderGeometry(0.3, 0.4, 3, isLow ? 4 : 8);
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5c4033 });
        const trunk = new THREE.Mesh(trunkGeom, trunkMat);
        trunk.position.y = 1.5;
        if (!isLow) trunk.castShadow = true;
        group.add(trunk);

        // Copa (Hojas)
        const leavesMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57 });
        const numClouds = isLow ? 1 : 3;
        for(let i=0; i<numClouds; i++) {
            const leavesGeom = isLow 
                ? new THREE.BoxGeometry(2.5, 2.5, 2.5)
                : new THREE.IcosahedronGeometry(1.5 + Math.random(), 1);
            const leaves = new THREE.Mesh(leavesGeom, leavesMat);
            leaves.position.set(
                isLow ? 0 : (Math.random() - 0.5), 
                3 + i * 1.5, 
                isLow ? 0 : (Math.random() - 0.5)
            );
            if (!isLow) leaves.castShadow = true;
            group.add(leaves);
        }

        group.position.set(x, y, z);
        this.scene.add(group);
    }

    createSpeedSign(x, y, z, limit, rotationY) {
        // Poste
        const poleGeom = new THREE.CylinderGeometry(0.1, 0.1, 3);
        const poleMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
        const pole = new THREE.Mesh(poleGeom, poleMat);
        pole.position.set(x, y + 1.5, z);
        this.scene.add(pole);

        // Cartel circular (Uruguay)
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // Fondo blanco con borde rojo
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(128, 128, 120, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ef4444'; // Rojo
        ctx.lineWidth = 25;
        ctx.stroke();

        // Texto negro
        ctx.fillStyle = 'black';
        ctx.font = 'bold 90px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(limit.toString(), 128, 128);

        const group = new THREE.Group();
        group.position.set(x, y + 3.5, z);
        group.rotation.y = rotationY;
        this.scene.add(group);

        // Cuerpo circular blanco
        const signGeom = new THREE.CylinderGeometry(1.2, 1.2, 0.1, 32);
        const signMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const sign = new THREE.Mesh(signGeom, signMat);
        sign.rotation.x = Math.PI / 2;
        group.add(sign);

        // Borde rojo (Aro 3D)
        const borderGeom = new THREE.TorusGeometry(1.1, 0.08, 8, 32);
        const borderMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const border = new THREE.Mesh(borderGeom, borderMat);
        border.position.z = 0.06;
        group.add(border);

        // Cara frontal con número (Plano para estabilidad total)
        const tex = new THREE.CanvasTexture(canvas);
        const faceGeom = new THREE.PlaneGeometry(1.8, 1.8);
        const faceMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
        const face = new THREE.Mesh(faceGeom, faceMat);
        face.position.z = 0.07;
        group.add(face);

        // Añadir zona de velocidad
        this.speedZones.push({
            box: new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, 2, z), new THREE.Vector3(114, 10, 114)),
            limit: limit
        });
    }

    createTrafficInspector(x, z, rotationY) {
        // Usar el sistema de peatones para crear el humanoide
        const inspector = this.pedestrianSystem.createHumanoid();
        
        // Chaleco reflectivo (Verde Neón)
        const vestMat = new THREE.MeshLambertMaterial({ color: 0xccff00 });
        const torso = inspector.children.find(c => c.geometry && c.geometry.type === 'BoxGeometry' && c.position.y === 1.2);
        if (torso) {
            const vestGeom = new THREE.BoxGeometry(0.52, 0.4, 0.32);
            const vest = new THREE.Mesh(vestGeom, vestMat);
            vest.position.y = 0.1;
            torso.add(vest);
        }

        inspector.position.set(x, 0, z);
        inspector.rotation.y = rotationY;
        this.scene.add(inspector);

        // Estado del inspector (0: Siga, 1: Pare)
        const state = Math.random() > 0.5 ? 1 : 0;
        
        // Si el estado es PARE, levantar el brazo
        if (state === 1) {
            inspector.limbs.armR.rotation.x = -Math.PI / 2;
        }

        const inspectorData = {
            mesh: inspector,
            state: state, // 0: GO, 1: STOP
            timer: 0,
            box: new THREE.Box3().setFromCenterAndSize(
                new THREE.Vector3(x, 2, z),
                new THREE.Vector3(20, 10, 20)
            )
        };
        this.inspectors.push(inspectorData);
    }

    update(dt) {
        // Animar banderas
        this.flags.forEach(flag => {
            flag.time += dt * 5;
            const positions = flag.mesh.geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
                const x = positions.getX(i);
                const normX = (x + 2) / 4; 
                const newZ = Math.sin(normX * 5 - flag.time) * (normX * 0.5); 
                positions.setZ(i, newZ);
            }
            positions.needsUpdate = true;
        });

        // Ciclar estado de inspectores
        this.inspectors.forEach(ins => {
            ins.timer += dt;
            if (ins.timer > 8) { // Cambia cada 8 segundos
                ins.state = ins.state === 0 ? 1 : 0;
                ins.timer = 0;
                // Animar brazo
                if (ins.state === 1) {
                    ins.mesh.limbs.armR.rotation.x = -Math.PI / 2;
                } else {
                    ins.mesh.limbs.armR.rotation.x = 0;
                }
            }
        });
    }

    checkZones(vehicle, uiManager) {
        let currentLimit = CONSTANTS.CITY_SPEED_LIMIT;
        let isOffRoad    = true;
        let inYieldZone  = false;
        let inspectorStop = false;
        let inSchoolZone  = false;

        const pos     = vehicle.mesh.position;
        const speedKmh = Math.abs(vehicle.speed * 3.6);

        // Inspectores
        for (const ins of this.inspectors) {
            if (ins.box.containsPoint(pos)) {
                if (ins.state === 1) {
                    uiManager.showMessage('👮 INSPECTOR: ¡DETÉNGASE!', true);
                    inspectorStop = true;
                } else {
                    uiManager.showMessage('👮 INSPECTOR: SIGA');
                }
            }
        }

        // Zona escolar (ya incluida en speedZones con inSchoolZone=true)
        if (this.schoolSignBox && this.schoolSignBox.containsPoint(pos)) {
            uiManager.showMessage('⚠️ ZONA ESCOLAR — Máx. 30 km/h', true);
            inSchoolZone = true;
        }

        // Límites dinámicos de velocidad
        for (const zone of this.speedZones) {
            if (zone.box.containsPoint(pos)) {
                currentLimit = zone.limit;
                if (zone.inSchoolZone) inSchoolZone = true;
            }
        }

        // PARE
        for (const zone of this.stopZones) {
            if (zone.box.containsPoint(pos)) {
                if (speedKmh < 1) zone.completed = true;
            }
        }

        // Off-road
        for (const rbox of this.roadBoxes) {
            if (rbox.containsPoint(pos)) { isOffRoad = false; break; }
        }

        // Rotondas
        for (const zone of this.yieldZones) {
            if (zone.containsPoint(pos)) {
                inYieldZone = true;
                if (speedKmh > CONSTANTS.ROUNDABOUT_SPEED_LIMIT) {
                    uiManager.showMessage('⚠️ CEDA EL PASO — Rotonda (baje velocidad)', true);
                }
            }
        }

        // Verificar si está en estacionamiento
        let isInParking = false;
        for (const zone of this.parkingZones || []) {
            if (zone.containsPoint(pos)) {
                isInParking = true;
                break;
            }
        }

        return {
            currentLimit,
            isOffRoad,
            isInParking,
            inYieldZone,
            inspectorStop,
            inSchoolZone,
            activeStopZones: this.stopZones.filter(z => z.box.containsPoint(pos))
        };
    }

    // ── Flecha pintada en el asfalto ─────────────────────────────────────────
    createRoadArrow(x, z, dirX) {
        // Cuerpo de la flecha
        const bodyGeom = new THREE.PlaneGeometry(5, 1.2);
        const mat      = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const body     = new THREE.Mesh(bodyGeom, mat);
        body.rotation.x = -Math.PI / 2;
        // Rotar si va hacia la izquierda (-X)
        body.rotation.z = dirX > 0 ? 0 : Math.PI;
        body.position.set(x, 0.03, z);
        this.scene.add(body);

        // Punta de la flecha (triángulo)
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(-1.2, -2);
        shape.lineTo( 1.2, -2);
        shape.closePath();
        const tipGeom  = new THREE.ShapeGeometry(shape);
        const tip      = new THREE.Mesh(tipGeom, mat);
        tip.rotation.x = -Math.PI / 2;
        tip.rotation.z = dirX > 0 ? -Math.PI / 2 : Math.PI / 2;
        tip.position.set(x + dirX * 3.5, 0.03, z);
        this.scene.add(tip);
    }

    // ── Cartel azul de 1 sentido (vereda) ────────────────────────────────────
    createOneWaySign(x, z, dirX) {
        // Poste
        const poleGeom = new THREE.CylinderGeometry(0.06, 0.06, 3, 6);
        const poleMat  = new THREE.MeshLambertMaterial({ color: 0x666666 });
        const pole     = new THREE.Mesh(poleGeom, poleMat);
        pole.position.set(x, 1.5, z);
        this.scene.add(pole);

        // Panel rectangular azul - PARALELO a la calle
        const panel = new THREE.Mesh(
            new THREE.BoxGeometry(2.5, 0.8, 0.1),
            new THREE.MeshLambertMaterial({ color: 0x1a56db })
        );
        panel.position.set(x, 3.2, z);
        // Si dirX es horizontal, el panel debe estar en el plano XY (rotationY=0)
        panel.rotation.y = 0;
        this.scene.add(panel);

        const arrowGroup = new THREE.Group();
        const arrowBody = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.2, 0.02), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        arrowGroup.add(arrowBody);
        
        const arrowTipShape = new THREE.Shape();
        arrowTipShape.moveTo(0, 0.4);
        arrowTipShape.lineTo(0.5, 0);
        arrowTipShape.lineTo(0, -0.4);
        const arrowTip = new THREE.Mesh(new THREE.ShapeGeometry(arrowTipShape), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        arrowTip.position.set(0.7, 0, 0);
        arrowGroup.add(arrowTip);

        arrowGroup.position.set(0, 0, 0.06);
        if (dirX < 0) arrowGroup.rotation.y = Math.PI;
        panel.add(arrowGroup);
    }

    // ── Cartel rojo CONTRAMANO ────────────────────────────────────────────────
    createWrongWaySign(x, z, allowedDirX) {
        // Poste
        const poleGeom = new THREE.CylinderGeometry(0.06, 0.06, 3, 6);
        const poleMat  = new THREE.MeshLambertMaterial({ color: 0x666666 });
        const pole     = new THREE.Mesh(poleGeom, poleMat);
        pole.position.set(x, 1.5, z);
        this.scene.add(pole);

        const group = new THREE.Group();
        group.position.set(x, 3.2, z);
        group.rotation.y = allowedDirX > 0 ? Math.PI / 2 : -Math.PI / 2;
        this.scene.add(group);

        // Panel circular rojo
        const circ = new THREE.Mesh(
            new THREE.CylinderGeometry(0.7, 0.7, 0.1, 16),
            new THREE.MeshLambertMaterial({ color: 0xcc0000 })
        );
        circ.rotation.x = Math.PI / 2;
        group.add(circ);

        // Barra blanca
        const bar = new THREE.Mesh(
            new THREE.BoxGeometry(1.0, 0.22, 0.02),
            new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        bar.position.set(0, 0, 0.06); 
        group.add(bar);


    }

    // Verificar si el jugador va en contramano (llamado desde ScoringSystem)
    checkOneWay(vehicle) {
        const pos  = vehicle.mesh.position;
        const vDirX = Math.sin(vehicle.mesh.rotation.y);
        for (const zone of this.oneWayZones) {
            if (zone.box.containsPoint(pos)) {
                // Si el componente X de la dirección del jugador es opuesto al permitido
                if (zone.dirX * vDirX < -0.5) {
                    return { wrongWay: true };
                }
            }
        }
        return { wrongWay: false };
    }

    // ── Estacionamiento Abierto (Bloque dedicado) ──────────────────────────────
    createParkingLot(x, z) {
        const size = CONSTANTS.BLOCK_SIZE; // 100
        const sw   = CONSTANTS.SIDEWALK_WIDTH; // 14

        // Vereda/Base de concreto
        const base = new THREE.Mesh(
            new THREE.PlaneGeometry(size, size),
            new THREE.MeshLambertMaterial({ color: 0xcccccc, map: TextureGenerator.getSidewalkTexture() })
        );
        base.rotation.x = -Math.PI / 2;
        base.position.set(x, 0.03, z);
        this.scene.add(base);

        // Área central de asfalto/cemento para estacionar (80x80)
        const asphalt = new THREE.Mesh(
            new THREE.PlaneGeometry(size - 20, size - 20),
            new THREE.MeshLambertMaterial({ color: 0x9e9e8a })
        );
        asphalt.rotation.x = -Math.PI / 2;
        asphalt.position.set(x, 0.04, z);
        this.scene.add(asphalt);

        // Pintar muchas plazas
        const wMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const startX = x - 30;
        const startZ = z - 30;
        for (let row = 0; row < 2; row++) {
            for (let col = 0; col < 6; col++) {
                const px = startX + col * 12;
                const pz = startZ + row * 40;
                // Líneas laterales de la plaza
                for (let dx of [-4, 4]) {
                    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 10), wMat);
                    l.rotation.x = -Math.PI / 2;
                    l.position.set(px + dx, 0.05, pz);
                    this.scene.add(l);
                }
            }
        }

        // Carteles de "E" en los accesos
        this.createParkingSign(x - 45, 0, z - 45);
        this.createParkingSign(x + 45, 0, z + 45);

        // Guardar zona segura de estacionamiento
        this.parkingZones.push(new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(x, 2, z),
            new THREE.Vector3(100, 10, 100)
        ));
    }

    createParkingSign(x, y, z) {
        const pole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1, 0.1, 3),
            new THREE.MeshLambertMaterial({ color: 0x555555 })
        );
        pole.position.set(x, y + 1.5, z);
        this.scene.add(pole);

        const group = new THREE.Group();
        group.position.set(x, y + 3.5, z);
        // Mirar a la calle
        group.rotation.y = 0; 
        this.scene.add(group);

        // En Uruguay el cartel de estacionamiento es Azul con una 'E' blanca
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1565c0'; // Azul
        ctx.beginPath();
        ctx.arc(64, 64, 60, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = 'bold 80px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('E', 64, 64);

        const tex = new THREE.CanvasTexture(canvas);
        const panelGeom = new THREE.CylinderGeometry(1, 1, 0.1, 32);
        const panelMat = new THREE.MeshLambertMaterial({ color: 0x1565c0 });
        const panel = new THREE.Mesh(panelGeom, panelMat);
        panel.rotation.x = Math.PI / 2;
        group.add(panel);

        // Cara frontal 'E' (Plano para estabilidad)
        const faceGeom = new THREE.PlaneGeometry(1.5, 1.5);
        const faceMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
        const face = new THREE.Mesh(faceGeom, faceMat);
        face.position.z = 0.06;
        group.add(face);
    }

    createNoOvertakeSign(x, y, z, rotationY) {
        const poleGeom = new THREE.CylinderGeometry(0.1, 0.1, 3);
        const poleMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
        const pole = new THREE.Mesh(poleGeom, poleMat);
        pole.position.set(x, y + 1.5, z);
        this.scene.add(pole);

        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // Fondo blanco con borde rojo
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(128, 128, 120, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 25;
        ctx.stroke();

        // Dos autos (uno rojo, uno negro)
        // Auto negro (derecha)
        ctx.fillStyle = 'black';
        ctx.fillRect(140, 100, 40, 60);
        // Auto rojo (izquierda)
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(76, 100, 40, 60);

        const group = new THREE.Group();
        group.position.set(x, y + 3.5, z);
        group.rotation.y = rotationY;
        this.scene.add(group);

        const signGeom = new THREE.CylinderGeometry(1.2, 1.2, 0.1, 32);
        const signMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const sign = new THREE.Mesh(signGeom, signMat);
        sign.rotation.x = Math.PI / 2;
        group.add(sign);

        const tex = new THREE.CanvasTexture(canvas);
        const faceGeom = new THREE.PlaneGeometry(1.8, 1.8);
        const faceMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
        const face = new THREE.Mesh(faceGeom, faceMat);
        face.position.z = 0.07;
        group.add(face);
    }

}
