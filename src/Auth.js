import {
    initDB, crearUsuario, buscarUsuarioPorEmail, buscarUsuarioPorCedula,
    iniciarSesionDeJuego, guardarResultadoPrueba, obtenerPruebasDeUsuario,
    registrarAuditoria, contarAuditoriaReciente, buscarUsuarioPorId
} from './Database.js';

console.log('[VeloX] Auth.js v2 cargado');

// ---------- Hash de contraseña: PBKDF2-SHA256 (Web Crypto, sin librerías) ----------
// Cada contraseña lleva su propia sal aleatoria de 16 bytes y 600.000
// iteraciones (lo que recomienda OWASP para PBKDF2-HMAC-SHA256).
// Se guarda como  pbkdf2$iteraciones$sal$hash  (todo en base64).
const PBKDF2_ITER = 600000;
const aB64 = (u8) => btoa(String.fromCharCode(...u8));
const deB64 = (b64) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

async function derivar(password, sal, iteraciones) {
    const clave = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteraciones }, clave, 256);
    return new Uint8Array(bits);
}

export async function hashPassword(password) {
    const sal = crypto.getRandomValues(new Uint8Array(16));
    const hash = await derivar(password, sal, PBKDF2_ITER);
    return `pbkdf2$${PBKDF2_ITER}$${aB64(sal)}$${aB64(hash)}`;
}

/** Compara en tiempo constante (no revela en qué byte difiere). */
export async function verificarPassword(password, guardado) {
    const partes = String(guardado).split('$');
    if (partes.length !== 4 || partes[0] !== 'pbkdf2') return false;
    const hash = await derivar(password, deB64(partes[2]), Number(partes[1]));
    const esperado = deB64(partes[3]);
    if (hash.length !== esperado.length) return false;
    let diff = 0;
    for (let i = 0; i < hash.length; i++) diff |= hash[i] ^ esperado[i];
    return diff === 0;
}

// Correos que reciben rol de administrador al registrarse. CAMBIAR por el
// correo real del equipo. (En un sistema con servidor, el rol lo asigna el
// servidor y nunca el navegador.)
export const ADMIN_EMAILS = ['admin@velox.test'];

// ---------- Validaciones ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function esEmail(valor) {
    return EMAIL_RE.test(valor.trim());
}

/** Valida cédula uruguaya (7 u 8 dígitos) con el dígito verificador oficial. */
export function esCedulaValida(valor) {
    let ci = valor.replace(/[.\-\s]/g, '');
    if (!/^\d{7,8}$/.test(ci)) return false;
    while (ci.length < 8) ci = '0' + ci;

    const digitos = ci.split('').map(Number);
    const verificador = digitos.pop();
    const pesos = [2, 9, 8, 7, 6, 3, 4];
    const suma = digitos.reduce((acc, d, i) => acc + d * pesos[i], 0);
    const resto = suma % 10;
    const dv = resto === 0 ? 0 : 10 - resto;
    return dv === verificador;
}

export const PLANES = ['hora', 'combo15', 'premium'];

export const PLAN_LABEL = {
    hora: 'Clase por hora',
    combo15: 'Combo 15 clases',
    premium: 'Premium (ilimitado)',
};

export function validarPassword(password) {
    if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        return 'La contraseña debe combinar letras y números.';
    }
    return null; // null = sin errores
}

// ---------- Registro / login ----------

function filaAUsuario(fila) {
    return {
        id: fila.id,
        nombre: fila.nombre,
        email: fila.email,
        cedula: fila.cedula || null,
        planTipo: fila.plan_tipo,
        creditosTotales: fila.creditos_totales,   // null = sin tope
        creditosUsados: fila.creditos_usados,
        rol: fila.rol || 'usuario',
        planVence: fila.plan_vence || null,
    };
}

/**
 * Registra un usuario nuevo. El email es obligatorio; la cédula es opcional.
 * @returns {Promise<{ok:true, usuario:object} | {ok:false, error:string}>}
 */
export async function registrarUsuario({ nombre, email, cedulaRaw, password, planTipo }) {
    await initDB();

    nombre = nombre.trim();
    if (nombre.length < 2) return { ok: false, error: 'Ingresá tu nombre completo.' };

    email = email.trim().toLowerCase();
    if (!esEmail(email)) return { ok: false, error: 'El correo electrónico no es válido.' };

    // Cédula opcional: si la dejó vacía, no se guarda nada; si la completó,
    // tiene que ser una cédula válida de verdad.
    let cedula = null;
    if (cedulaRaw && cedulaRaw.trim()) {
        if (!esCedulaValida(cedulaRaw)) return { ok: false, error: 'La cédula ingresada no es válida.' };
        cedula = cedulaRaw.replace(/[.\-\s]/g, '');
    }

    if (!PLANES.includes(planTipo)) return { ok: false, error: 'Elegí un plan de clases.' };

    const errorPass = validarPassword(password);
    if (errorPass) return { ok: false, error: errorPass };

    if (buscarUsuarioPorEmail(email)) {
        return { ok: false, error: 'Ya existe una cuenta registrada con ese correo.' };
    }
    if (cedula && buscarUsuarioPorCedula(cedula)) {
        return { ok: false, error: 'Ya existe una cuenta registrada con esa cédula.' };
    }

    const passwordHash = await hashPassword(password);
    const rol = ADMIN_EMAILS.includes(email) ? 'admin' : 'usuario';
    crearUsuario({ nombre, email, cedula, passwordHash, planTipo, rol });

    const creado = buscarUsuarioPorEmail(email);
    registrarAuditoria(creado.id, 'REGISTRO', `plan=${planTipo}`);
    return { ok: true, usuario: filaAUsuario(creado) };
}

/**
 * Inicia sesión por email + contraseña.
 * @returns {Promise<{ok:true, usuario:object} | {ok:false, error:string}>}
 */
export async function iniciarSesion({ email, password }) {
    await initDB();

    email = email.trim().toLowerCase();
    const fila = buscarUsuarioPorEmail(email);
    if (!fila) return { ok: false, error: 'No existe una cuenta con ese correo. Registrate primero.' };

    // Freno a la fuerza bruta: 5 intentos fallidos en 10 minutos bloquean el acceso un rato.
    if (contarAuditoriaReciente(fila.id, 'LOGIN_FALLIDO', 10) >= 5) {
        return { ok: false, error: 'Demasiados intentos fallidos. Esperá unos minutos e intentá de nuevo.' };
    }

    if (!(await verificarPassword(password, fila.password_hash))) {
        registrarAuditoria(fila.id, 'LOGIN_FALLIDO');
        return { ok: false, error: 'Contraseña incorrecta.' };
    }

    registrarAuditoria(fila.id, 'LOGIN_OK');
    return { ok: true, usuario: filaAUsuario(fila) };
}

/**
 * Llamar justo antes de arrancar a jugar (botón COMENZAR). Gasta una ficha
 * si el plan es 'combo15'; bloquea si ya no quedan. 'hora' y 'premium'
 * nunca bloquean.
 */
export function registrarInicioDeJuego(usuarioId) {
    return iniciarSesionDeJuego(usuarioId);
}

/** Llamar al terminar una prueba (GameEngine.stop) para guardar el resultado. */
export function registrarResultadoPrueba(usuarioId, resultado) {
    guardarResultadoPrueba(usuarioId, resultado);
}

/** Historial de pruebas de un usuario (para una futura pantalla de progreso). */
export function historialDePruebas(usuarioId) {
    return obtenerPruebasDeUsuario(usuarioId);
}


/** Vuelve a leer al usuario (plan, fichas, vencimiento) después de un pago. */
export async function obtenerUsuario(id) {
    await initDB();
    const fila = buscarUsuarioPorId(id);
    return fila ? filaAUsuario(fila) : null;
}
