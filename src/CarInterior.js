import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
console.log('[VeloX] CarInterior.js v8 cargado');

const DRIVER_SIDE = 1;
// Posición X del conductor (volante, asiento, pedales, todo usa esto).
export const DRIVER_X = DRIVER_SIDE * 0.40;

const COLOR = {
    plasticGrey: 0x6f7580,
    plasticDark: 0x1c1d20,
    trimBlue:    0x16274a,
    seat:        0x1d2c46,
    silver:      0xc7ccd3,
    chrome:      0xe8eaee,
    glass:       0x1b2330,
};

function matPlasticGrey() { return new THREE.MeshStandardMaterial({ color: COLOR.plasticGrey, roughness: 0.75, metalness: 0.05 }); }
function matPlasticDark() { return new THREE.MeshStandardMaterial({ color: COLOR.plasticDark, roughness: 0.8,  metalness: 0.05 }); }
function matTrimBlue()    { return new THREE.MeshStandardMaterial({ color: COLOR.trimBlue,    roughness: 0.5,  metalness: 0.3  }); }
function matSeat()        { return new THREE.MeshStandardMaterial({ color: COLOR.seat,        roughness: 0.9,  metalness: 0.0  }); }
function matSilver()      { return new THREE.MeshStandardMaterial({ color: COLOR.silver,      roughness: 0.3,  metalness: 1.0  }); }
function matChrome()      { return new THREE.MeshStandardMaterial({ color: COLOR.chrome,      roughness: 0.15, metalness: 1.0  }); }
// ---- Helpers de geometría ----
function box(w, h, d, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
}
function cyl(rTop, rBot, h, mat, segs = 24) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segs), mat);
    m.castShadow = true;
    return m;
}
function sphere(r, mat, segs = 16) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, segs, segs), mat);
    m.castShadow = true;
    return m;
}
// Cilindro orientado entre dos puntos (para columna de dirección, palancas, espejo)
function cylBetween(a, b, radius, mat, segs = 16) {
    const start = new THREE.Vector3(...a);
    const end   = new THREE.Vector3(...b);
    const dir   = new THREE.Vector3().subVectors(end, start);
    const len   = dir.length();
    const m = cyl(radius, radius, len, mat, segs);
    m.position.copy(start).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return m;
}

// ---- Texturas dibujadas por código (canvas 2D -> CanvasTexture) ----
function makeSpeedoTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const cx = 128, cy = 128, r = 118;

    ctx.fillStyle = '#0c0d10'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c7ccd3'; ctx.lineWidth = 4; ctx.stroke();

    // Escala 0-220 km/h, arco de 220° empezando abajo-izq
    const startA = Math.PI * 0.75, endA = Math.PI * 2.25;
    for (let v = 0; v <= 220; v += 20) {
        const a = startA + (v / 220) * (endA - startA);
        const rx1 = cx + Math.cos(a) * (r - 10), ry1 = cy + Math.sin(a) * (r - 10);
        const rx2 = cx + Math.cos(a) * (r - 26), ry2 = cy + Math.sin(a) * (r - 26);
        ctx.strokeStyle = v % 40 === 0 ? '#e8eaee' : '#7a8290';
        ctx.lineWidth = v % 40 === 0 ? 3 : 1.5;
        ctx.beginPath(); ctx.moveTo(rx1, ry1); ctx.lineTo(rx2, ry2); ctx.stroke();
        if (v % 40 === 0) {
            const tx = cx + Math.cos(a) * (r - 42), ty = cy + Math.sin(a) * (r - 42);
            ctx.fillStyle = '#e8eaee'; ctx.font = '16px sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(String(v), tx, ty);
        }
    }
    ctx.fillStyle = '#8fa3c7'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('km/h', cx, cy + 46);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return { texture: tex, canvas: c, ctx, cx, cy, r, startA, endA };
}

function makeRadioTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#15171b'; ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#3a3f47'; ctx.lineWidth = 3; ctx.strokeRect(4, 4, 248, 120);

    // Pantalla
    ctx.fillStyle = '#0d2a22';
    ctx.fillRect(14, 14, 150, 46);
    ctx.strokeStyle = '#2fd18a'; ctx.lineWidth = 1.5; ctx.strokeRect(14, 14, 150, 46);
    ctx.fillStyle = '#2fd18a'; ctx.font = '20px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('FM 101.5', 22, 37);

    // Perillas
    for (const [x] of [[195], [232]]) {
        ctx.fillStyle = '#c7ccd3'; ctx.beginPath(); ctx.arc(x, 37, 16, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#3a3f47'; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = '#1c1d20'; ctx.beginPath(); ctx.moveTo(x, 25); ctx.lineTo(x, 37); ctx.stroke();
    }
    // Botones
    for (let i = 0; i < 6; i++) {
        ctx.fillStyle = '#2a2d33';
        ctx.fillRect(14 + i * 25, 78, 20, 34);
        ctx.strokeStyle = '#454a53'; ctx.strokeRect(14 + i * 25, 78, 20, 34);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

// ---- Piezas ----

function buildFloor() {
    const g = box(1.56, 0.04, 2.15, matTrimBlue());
    g.position.set(0, -0.28, -0.20);
    return g;
}

function buildDashboard() {

    const shape = new THREE.Shape();
    shape.moveTo(0.85, 0.05);
    shape.lineTo(0.85, 0.40);
    shape.lineTo(0.60, 0.14);
    shape.lineTo(0.60, 0.05);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.56, bevelEnabled: false, curveSegments: 1 });
    geo.translate(0, 0, -0.78);   
    geo.rotateY(-Math.PI / 2);    
    const dash = new THREE.Mesh(geo, matPlasticGrey());
    dash.castShadow = true; dash.receiveShadow = true;
    return dash;
}

function buildSpeedometer() {
    const group = new THREE.Group();
    const { texture, cx, cy, r, startA, endA } = makeSpeedoTexture();

    const face = new THREE.Mesh(new THREE.CircleGeometry(0.10, 32), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.4 }));
    group.add(face);

    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.10, 0.008, 10, 32), matChrome());
    group.add(bezel);

    // Aguja 
    const needle = box(0.006, 0.075, 0.004, new THREE.MeshStandardMaterial({ color: 0xff3b30, roughness: 0.4 }));
    needle.geometry.translate(0, 0.075 / 2 - 0.008, 0); // pivote en la base
    group.add(needle);

    // El panel queda integrado en el frente del tablero, dentro del volante.
    group.rotation.y = Math.PI;
    group.scale.setScalar(0.6);
    group.position.set(DRIVER_X, 0.35, 0.852);
    group.userData = { needle, startA, endA };
    return group;
}

function buildRadio() {
    const group = new THREE.Group();
    const texture = makeRadioTexture();
    const panel = box(0.18, 0.10, 0.01, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.5 }));
    group.add(panel);
    group.position.set(0, 0.14, 0.615);
    return group;
}

function buildSteeringWheel() {
    const group = new THREE.Group();
    const hubDepth = 0.028;

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.016, 14, 48), matPlasticDark());
    group.add(rim);

    const hub = cyl(0.062, 0.062, hubDepth, matPlasticDark(), 32);
    hub.rotation.x = Math.PI / 2;
    group.add(hub);

    for (const angDeg of [-90, 30, 150]) {
        const a = THREE.MathUtils.degToRad(angDeg);
        const len = 0.16 - 0.018 - 0.062;
        const spoke = box(len, 0.018, 0.024, matPlasticDark());
        spoke.position.set(Math.cos(a) * (0.062 + len / 2), Math.sin(a) * (0.062 + len / 2), 0);
        spoke.rotation.z = a;
        group.add(spoke);
    }

    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.004, 10, 40), matSilver());
    bezel.position.z = 0.018;
    group.add(bezel);

    const logoCanvas = document.createElement('canvas');
    logoCanvas.width = logoCanvas.height = 128;
    const logoContext = logoCanvas.getContext('2d');
    logoContext.fillStyle = '#16274a';
    logoContext.beginPath();
    logoContext.arc(64, 64, 62, 0, Math.PI * 2);
    logoContext.fill();
    logoContext.strokeStyle = '#e8eaee';
    logoContext.lineWidth = 8;
    logoContext.lineJoin = 'round';
    logoContext.beginPath();
    logoContext.moveTo(37, 38);
    logoContext.lineTo(64, 91);
    logoContext.lineTo(91, 38);
    logoContext.stroke();
    logoContext.fillStyle = '#e8eaee';
    logoContext.font = 'bold 12px sans-serif';
    logoContext.textAlign = 'center';
    logoContext.fillText('VELOX', 64, 111);

    const logoTexture = new THREE.CanvasTexture(logoCanvas);
    logoTexture.colorSpace = THREE.SRGBColorSpace;
    const hornPad = new THREE.Mesh(
        new THREE.CircleGeometry(0.036, 32),
        new THREE.MeshStandardMaterial({ map: logoTexture, roughness: 0.5 })
    );
    hornPad.position.z = 0.022;
    hornPad.name = 'hornButton';
    group.add(hornPad);

    group.rotation.x = THREE.MathUtils.degToRad(-18);
    group.rotation.y = Math.PI;
    group.position.set(DRIVER_X, 0.35, 0.68);
    group.userData = { hornPad };
    return group;
}

function buildSteeringColumnAndStalk() {
    const group = new THREE.Group();
    const colStart = [DRIVER_X, 0.14, 0.80];
    const colEnd   = [DRIVER_X, 0.29, 0.62];
    group.add(cylBetween(colStart, colEnd, 0.025, matPlasticDark()));

    // Collar de encendido (llave)
    const shroudCenter = [DRIVER_X, 0.17, 0.77];
    const shroud = cyl(0.05, 0.05, 0.08, matPlasticGrey());
    shroud.position.set(...shroudCenter);
    shroud.rotation.x = THREE.MathUtils.degToRad(-25);
    group.add(shroud);
    const keyHole = new THREE.Mesh(new THREE.CircleGeometry(0.016, 16), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    keyHole.position.set(shroudCenter[0] + DRIVER_SIDE * 0.045, shroudCenter[1] + 0.01, shroudCenter[2] + 0.01);
    keyHole.rotation.x = THREE.MathUtils.degToRad(-25 + 90);
    group.add(keyHole);

    // Palanca de luces/giro
    const stalkPivot = [DRIVER_X + DRIVER_SIDE * 0.06, 0.24, 0.68];
    const stalk = new THREE.Group();
    stalk.position.set(...stalkPivot);
    const stalkArm = cylBetween([0, 0, 0], [DRIVER_SIDE * 0.10, -0.01, 0.02], 0.009, matPlasticDark());
    const stalkTip = sphere(0.014, matPlasticDark());
    stalkTip.position.set(DRIVER_SIDE * 0.10, -0.01, 0.02);
    stalk.add(stalkArm, stalkTip);
    group.add(stalk);

    group.userData = { turnSignalStalk: stalk };
    return group;
}

function buildConsoleAndGearLever() {
    const group = new THREE.Group();
    const console_ = box(0.22, 0.16, 0.55, matPlasticGrey());
    console_.position.set(0, -0.18, 0.30);
    group.add(console_);

    const gearBase = cyl(0.05, 0.06, 0.02, matPlasticDark());
    gearBase.position.set(0, -0.10, 0.35);
    group.add(gearBase);

    const lever = new THREE.Group();
    lever.position.set(0, -0.09, 0.35);
    const rod = cylBetween([0, 0, 0], [0, 0.14, 0], 0.012, matPlasticDark());
    const knob = sphere(0.028, matSilver());
    knob.position.set(0, 0.15, 0);
    lever.add(rod, knob);
    group.add(lever);

    group.userData = { gearLever: lever };
    return group;
}

function buildPedals() {
    const group = new THREE.Group();
    const baseX = DRIVER_X, baseY = -0.28, baseZ = 0.75;

    function pedal(offsetX, tall) {
        const p = new THREE.Group();
        const pad = box(0.08, tall, 0.02, matPlasticDark());
        pad.geometry.translate(0, tall / 2, 0); 
        pad.rotation.x = THREE.MathUtils.degToRad(20); 
        p.add(pad);
        p.position.set(baseX + offsetX, baseY, baseZ);
        p.userData = { pad };
        return p;
    }
    const brake = pedal(DRIVER_SIDE * -0.09, 0.18); 
    const accel = pedal(DRIVER_SIDE * 0.03, 0.16);
    group.add(brake, accel);
    group.userData = { brakePedal: brake, accelPedal: accel };
    return group;
}

function buildSeats() {
    const group = new THREE.Group();

    function seat(x, z) {
        const s = new THREE.Group();
        const cushion = box(0.34, 0.16, 0.38, matSeat());
        cushion.position.set(0, -0.18, 0.30);
        s.add(cushion);

        const back = box(0.34, 0.42, 0.10, matSeat());
        back.geometry.translate(0, 0.21, -0.05); 
        back.position.set(0, -0.10, 0.11);
        back.rotation.x = THREE.MathUtils.degToRad(10); 
        s.add(back);

        const headrest = box(0.22, 0.10, 0.08, matSeat());
        headrest.position.set(0, 0.40, 0.06);
        s.add(headrest);

        s.position.set(x, 0, z - 0.30); 
        return s;
    }

    const seatL = seat(DRIVER_X, 0.30);   
    const seatR = seat(-DRIVER_X, 0.30);  
    group.add(seatL, seatR);

    // Banco trasero simple
    const rearCushion = box(1.35, 0.15, 0.42, matSeat());
    rearCushion.position.set(0, -0.185, -0.55);
    const rearBack = box(1.35, 0.40, 0.10, matSeat());
    rearBack.position.set(0, 0.02, -0.78);
    rearBack.rotation.x = THREE.MathUtils.degToRad(-8);
    group.add(rearCushion, rearBack);

    return group;
}

function buildInteriorMirror() {
    const group = new THREE.Group();
    const top = [0, 0.80, 0.55];
    const bot = [0, 0.58, 0.62];
    group.add(cylBetween(top, bot, 0.008, matPlasticDark()));
    const housing = box(0.23, 0.065, 0.025, matPlasticDark());
    housing.position.set(bot[0], bot[1] - 0.02, bot[2]);
    const glass = new Reflector(new THREE.PlaneGeometry(0.205, 0.046), {
        clipBias: 0.003,
        textureWidth: 256,
        textureHeight: 128,
        color: 0xb8c7d5,
    });
    glass.position.set(bot[0], bot[1] - 0.02, bot[2] - 0.014);
    glass.rotation.y = Math.PI;
    group.add(housing, glass);
    group.userData.mirrors = [glass];
    return group;
}

function buildSideMirrors() {
    const group = new THREE.Group();
    const mirrors = [];
    function mirror(x) {
        const m = new THREE.Group();
        const housing = box(0.06, 0.085, 0.12, matTrimBlue());
        const glass = new Reflector(new THREE.PlaneGeometry(0.105, 0.068), {
            clipBias: 0.003,
            textureWidth: 256,
            textureHeight: 160,
            color: 0xb8c7d5,
        });
        glass.rotation.y = x > 0 ? -2.25 : 2.25;
        glass.position.x = x > 0 ? -0.032 : 0.032;
        m.add(housing, glass);
        m.position.set(x, 0.455, 0.525);
        mirrors.push(glass);
        return m;
    }
    group.add(mirror(0.715), mirror(-0.715));
    group.userData.mirrors = mirrors;
    return group;
}

export function createCarInterior() {
    const group = new THREE.Group();
    group.name = 'proceduralInterior';

    const floor = buildFloor();
    const dash = buildDashboard();
    const speedo = buildSpeedometer();
    const radio = buildRadio();
    const wheel = buildSteeringWheel();
    const colStalk = buildSteeringColumnAndStalk();
    const consoleGear = buildConsoleAndGearLever();
    const pedals = buildPedals();
    const seats = buildSeats();
    const mirrorIn = buildInteriorMirror();
    const mirrorsOut = buildSideMirrors();

    group.add(floor, dash, speedo, radio, wheel, colStalk, consoleGear, pedals, seats, mirrorIn, mirrorsOut);

    const mirrors = [...mirrorIn.userData.mirrors, ...mirrorsOut.userData.mirrors];
    mirrors.forEach(mirror => {
        const renderMirror = mirror.onBeforeRender;
        mirror.onBeforeRender = function(renderer, scene, camera) {
            const visibility = mirrors.map(other => other.visible);
            mirrors.forEach(other => {
                if (other !== this) other.visible = false;
            });
            try {
                renderMirror.call(this, renderer, scene, camera);
            } finally {
                mirrors.forEach((other, index) => { other.visible = visibility[index]; });
            }
        };
    });

    group.traverse(o => { if (o.isMesh) o.castShadow = false; });

    return {
        group,
        refs: {
            speedoNeedle: speedo.userData.needle,
            speedoAngles: { start: speedo.userData.startA, end: speedo.userData.endA },
            hornPad: wheel.userData.hornPad,
            mirrors,
            turnSignalStalk: colStalk.userData.turnSignalStalk,
            gearLever: consoleGear.userData.gearLever,
            brakePedal: pedals.userData.brakePedal,
            accelPedal: pedals.userData.accelPedal,
        },
    };
}

/** Gira la aguja del velocímetro según la velocidad actual (0..maxKmh). */
export function updateSpeedNeedle(refs, speedKmh, maxKmh = 220) {
    if (!refs || !refs.speedoNeedle) return;
    const t = THREE.MathUtils.clamp(speedKmh / maxKmh, 0, 1);
    const { start, end } = refs.speedoAngles;
    const angle = start + t * (end - start);
    refs.speedoNeedle.rotation.z = (3 * Math.PI / 2) - angle;
}

/** Presiona/suelta el pedal indicado ('accel' | 'brake'), 0 = suelto, 1 = a fondo. */
export function setPedalPress(refs, which, amount01) {
    const pedal = which === 'brake' ? refs.brakePedal : refs.accelPedal;
    if (!pedal) return;
    const extra = THREE.MathUtils.clamp(amount01, 0, 1) * THREE.MathUtils.degToRad(18);
    pedal.userData.pad.rotation.x = THREE.MathUtils.degToRad(20) + extra;
}

/** Mueve la palanca de giro hacia arriba/abajo/centro*/
export function setTurnSignalStalk(refs, dir) {
    if (!refs || !refs.turnSignalStalk) return;
    refs.turnSignalStalk.rotation.z = dir * THREE.MathUtils.degToRad(12);
}