/**
 * Base de datos SQLite corriendo 100% en el navegador (sql.js = SQLite
 * compilado a WebAssembly). No necesita ningún servidor: la base se guarda
 * como un archivo binario dentro de localStorage, y se recarga cada vez que
 * abrís la página.
 *
 * Requisito: cargar la librería sql.js antes de usar este módulo. La forma
 * más simple es agregar en el <head> de tu HTML:
 *
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js"></script>
 *
 * Eso deja disponible la función global `initSqlJs`, que este archivo usa.
 */

console.log('[VeloX] Database.js v2 cargado');

const LS_KEY = 'simulador_db_v1';

let SQL = null;   // motor sql.js ya inicializado
let db = null;    // instancia de la base de datos (en memoria)

async function cargarMotor() {
    if (SQL) return SQL;
    if (typeof initSqlJs !== 'function') {
        throw new Error(
            'sql.js no está cargado. Agregá en tu HTML: ' +
            '<script src="https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js"></script>'
        );
    }
    SQL = await initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
    });
    return SQL;
}

function guardarEnLocalStorage() {
    const data = db.export();             // Uint8Array con el archivo .sqlite completo
    let binario = '';
    for (let i = 0; i < data.length; i++) binario += String.fromCharCode(data[i]);
    localStorage.setItem(LS_KEY, btoa(binario));
}

function cargarDesdeLocalStorage() {
    const b64 = localStorage.getItem(LS_KEY);
    if (!b64) return null;
    const binario = atob(b64);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    return bytes;
}

function columnasDe(tabla) {
    const r = db.exec(`PRAGMA table_info(${tabla})`);
    return r.length ? r[0].values.map(v => v[1]) : [];
}

function agregarColumnaSiFalta(tabla, columna, definicion) {
    if (!columnasDe(tabla).includes(columna)) {
        db.run(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
    }
}

// El primer prototipo guardaba usuarios con otro esquema (login por cédula).
// Si aparece ese esquema viejo, se reinicia (solo es válido en el prototipo).
function migrarEsquemaViejo() {
    const cols = columnasDe('usuarios');
    if (cols.length && !cols.includes('email')) {
        console.warn('[VeloX] Esquema viejo de base de datos: se reinicia.');
        db.run('DROP TABLE IF EXISTS pruebas');
        db.run('DROP TABLE IF EXISTS sesiones');
        db.run('DROP TABLE IF EXISTS usuarios');
    }
}

/** Inicializa (o carga) la base de datos. Llamar una sola vez al arrancar. */
export async function initDB() {
    if (db) return db;
    const engine = await cargarMotor();
    const existente = cargarDesdeLocalStorage();

    db = existente ? new engine.Database(existente) : new engine.Database();

    migrarEsquemaViejo();

    db.run(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre           TEXT NOT NULL,
            email            TEXT NOT NULL UNIQUE,   -- siempre obligatorio, es con lo que inicia sesión
            cedula           TEXT UNIQUE,            -- opcional (puede ser NULL)
            password_hash    TEXT NOT NULL,
            plan_tipo        TEXT NOT NULL,           -- 'hora' | 'combo15' | 'premium'
            creditos_totales INTEGER,                 -- 15 para combo15; NULL = sin tope (hora y premium)
            creditos_usados  INTEGER NOT NULL DEFAULT 0,
            fecha_registro   TEXT NOT NULL DEFAULT (datetime('now')),
            rol              TEXT NOT NULL DEFAULT 'usuario',  -- 'usuario' | 'admin'
            plan_vence       TEXT                              -- solo suscripción premium (NULL = sin vencimiento)
        );
    `);
    agregarColumnaSiFalta('usuarios', 'rol', "TEXT NOT NULL DEFAULT 'usuario'");
    agregarColumnaSiFalta('usuarios', 'plan_vence', 'TEXT');

    // Un registro por cada vez que la persona entra a jugar (para 'hora' es
    // el historial de visitas; para 'combo15' es lo que va gastando las
    // fichas; para 'premium' es solo estadística).
    db.run(`
        CREATE TABLE IF NOT EXISTS sesiones (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id      INTEGER NOT NULL REFERENCES usuarios(id),
            fecha           TEXT NOT NULL DEFAULT (datetime('now'))
        );
    `);

    // Un registro por cada prueba de manejo terminada (aprobada o no).
    db.run(`
        CREATE TABLE IF NOT EXISTS pruebas (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id      INTEGER NOT NULL REFERENCES usuarios(id),
            fecha           TEXT NOT NULL DEFAULT (datetime('now')),
            puntaje         INTEGER NOT NULL,
            aprobado        INTEGER NOT NULL,   -- 0 | 1
            duracion_seg    INTEGER,
            distancia_m     REAL,
            motivo_fin      TEXT
        );
    `);

    // Pagos. NUNCA se guarda número de tarjeta, vencimiento ni CVV: solo la
    // marca, los últimos 4 dígitos y un token que devuelve la pasarela.
    db.run(`
        CREATE TABLE IF NOT EXISTS pagos (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id        INTEGER NOT NULL REFERENCES usuarios(id),
            plan_tipo         TEXT NOT NULL,
            cantidad          INTEGER NOT NULL DEFAULT 1,
            monto_uyu         INTEGER NOT NULL,
            descuento_uyu     INTEGER NOT NULL DEFAULT 0,
            metodo            TEXT NOT NULL CHECK (metodo IN ('efectivo','tarjeta')),
            estado            TEXT NOT NULL CHECK (estado IN ('pendiente','aprobado','rechazado','anulado')),
            referencia        TEXT NOT NULL UNIQUE,
            tarjeta_marca     TEXT,
            tarjeta_ultimos4  TEXT,
            token_pasarela    TEXT,
            fecha_creacion    TEXT NOT NULL DEFAULT (datetime('now')),
            fecha_resolucion  TEXT,
            resuelto_por      INTEGER REFERENCES usuarios(id)
        );
    `);

    // Registro de auditoría (quién hizo qué y cuándo). Sin datos sensibles.
    db.run(`
        CREATE TABLE IF NOT EXISTS auditoria (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha       TEXT NOT NULL DEFAULT (datetime('now')),
            usuario_id  INTEGER,
            accion      TEXT NOT NULL,
            detalle     TEXT
        );
    `);

    if (!existente) guardarEnLocalStorage(); // primera vez: persistimos las tablas recién creadas
    return db;
}

// Fichas por plan al registrarse. 'hora' y 'premium' quedan sin tope (NULL);
// 'combo15' arranca con 15 fichas para gastar.
const CREDITOS_INICIALES = { hora: null, combo15: 15, premium: null };

/** Inserta un usuario nuevo. Lanza error si el email o la cédula ya existen. */
export function crearUsuario({ nombre, email, cedula, passwordHash, planTipo, rol = 'usuario' }) {
    const stmt = db.prepare(`
        INSERT INTO usuarios (nombre, email, cedula, password_hash, plan_tipo, creditos_totales, rol)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    try {
        stmt.run([nombre, email, cedula || null, passwordHash, planTipo, CREDITOS_INICIALES[planTipo], rol]);
    } finally {
        stmt.free();
    }
    guardarEnLocalStorage();
}

/** Busca un usuario por email (es el identificador de inicio de sesión). */
export function buscarUsuarioPorEmail(email) {
    const stmt = db.prepare(`SELECT * FROM usuarios WHERE email = ?`);
    stmt.bind([email]);
    let row = null;
    if (stmt.step()) row = stmt.getAsObject();
    stmt.free();
    return row;
}

/** Busca un usuario por cédula (para chequear duplicados al registrarse). */
export function buscarUsuarioPorCedula(cedula) {
    if (!cedula) return null;
    const stmt = db.prepare(`SELECT * FROM usuarios WHERE cedula = ?`);
    stmt.bind([cedula]);
    let row = null;
    if (stmt.step()) row = stmt.getAsObject();
    stmt.free();
    return row;
}

/**
 * Registra el inicio de una visita de juego y gasta una ficha si corresponde.
 * Devuelve { ok:true } si puede jugar, o { ok:false, error } si no le
 * quedan fichas (solo pasa con 'combo15').
 */
export function iniciarSesionDeJuego(usuarioId) {
    const stmt = db.prepare(`SELECT * FROM usuarios WHERE id = ?`);
    stmt.bind([usuarioId]);
    if (!stmt.step()) { stmt.free(); return { ok: false, error: 'Usuario no encontrado.' }; }
    const u = stmt.getAsObject();
    stmt.free();

    if (u.plan_tipo === 'premium' && u.plan_vence && new Date(u.plan_vence.replace(' ', 'T') + 'Z') < new Date()) {
        return { ok: false, error: 'Tu suscripción premium venció. Renovála para seguir jugando.' };
    }
    if (u.plan_tipo === 'combo15' && u.creditos_usados >= u.creditos_totales) {
        return { ok: false, error: 'Ya usaste tus 15 clases del combo. Contactate para renovar el plan.' };
    }

    db.run(`INSERT INTO sesiones (usuario_id) VALUES (?)`, [usuarioId]);
    if (u.plan_tipo !== 'premium') {
        db.run(`UPDATE usuarios SET creditos_usados = creditos_usados + 1 WHERE id = ?`, [usuarioId]);
    }
    guardarEnLocalStorage();

    const restantes = u.plan_tipo === 'combo15' ? (u.creditos_totales - u.creditos_usados - 1) : null;
    return { ok: true, restantes };
}

/** Guarda el resultado de una prueba de manejo terminada. */
export function guardarResultadoPrueba(usuarioId, { puntaje, aprobado, duracionSeg, distanciaM, motivoFin }) {
    const stmt = db.prepare(`
        INSERT INTO pruebas (usuario_id, puntaje, aprobado, duracion_seg, distancia_m, motivo_fin)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    try {
        stmt.run([usuarioId, puntaje, aprobado ? 1 : 0, duracionSeg ?? null, distanciaM ?? null, motivoFin ?? null]);
    } finally {
        stmt.free();
    }
    guardarEnLocalStorage();
}

/** Historial de pruebas de un usuario, más recientes primero. */
export function obtenerPruebasDeUsuario(usuarioId) {
    const res = db.exec(`SELECT * FROM pruebas WHERE usuario_id = ${Number(usuarioId)} ORDER BY fecha DESC`);
    if (!res.length) return [];
    const [{ columns, values }] = res;
    return values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
}

/** Útil para pantallas de administración/depuración durante el desarrollo. */
export function listarUsuarios() {
    const res = db.exec(`SELECT id, nombre, identificador, tipo_id, fecha_registro FROM usuarios`);
    if (!res.length) return [];
    const [{ columns, values }] = res;
    return values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
}

/** Borra toda la base (botón "olvidar todo" durante pruebas). */
export function borrarBaseDeDatos() {
    localStorage.removeItem(LS_KEY);
    db = null;
}


// ───────────────────────── Usuarios (consultas extra) ─────────────────────────

export function buscarUsuarioPorId(id) {
    const stmt = db.prepare(`SELECT * FROM usuarios WHERE id = ?`);
    stmt.bind([id]);
    let row = null;
    if (stmt.step()) row = stmt.getAsObject();
    stmt.free();
    return row;
}

// ─────────────────────────────── Auditoría ───────────────────────────────

/** Anota una acción. `detalle` nunca debe llevar datos sensibles. */
export function registrarAuditoria(usuarioId, accion, detalle = null) {
    db.run(`INSERT INTO auditoria (usuario_id, accion, detalle) VALUES (?, ?, ?)`, [usuarioId ?? null, accion, detalle]);
    guardarEnLocalStorage();
}

/** Cuántas veces ocurrió `accion` para ese usuario en los últimos `minutos`. */
export function contarAuditoriaReciente(usuarioId, accion, minutos) {
    const stmt = db.prepare(
        `SELECT COUNT(*) AS n FROM auditoria WHERE usuario_id = ? AND accion = ? AND fecha >= datetime('now', ?)`
    );
    stmt.bind([usuarioId, accion, `-${Number(minutos)} minutes`]);
    stmt.step();
    const n = stmt.getAsObject().n;
    stmt.free();
    return n;
}

export function listarAuditoria(limite = 100) {
    const stmt = db.prepare(`SELECT * FROM auditoria ORDER BY id DESC LIMIT ?`);
    stmt.bind([Number(limite)]);
    const filas = [];
    while (stmt.step()) filas.push(stmt.getAsObject());
    stmt.free();
    return filas;
}

// ────────────────────────────────── Pagos ──────────────────────────────────

export function crearPago(p) {
    const stmt = db.prepare(`
        INSERT INTO pagos (usuario_id, plan_tipo, cantidad, monto_uyu, descuento_uyu, metodo, estado,
                           referencia, tarjeta_marca, tarjeta_ultimos4, token_pasarela, fecha_resolucion)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    try {
        stmt.run([p.usuarioId, p.planTipo, p.cantidad, p.montoUyu, p.descuentoUyu, p.metodo, p.estado,
                  p.referencia, p.tarjetaMarca ?? null, p.tarjetaUltimos4 ?? null, p.tokenPasarela ?? null,
                  p.estado === 'pendiente' ? null : new Date().toISOString().slice(0, 19).replace('T', ' ')]);
    } finally { stmt.free(); }
    guardarEnLocalStorage();
}

function filasDe(stmt) {
    const filas = [];
    while (stmt.step()) filas.push(stmt.getAsObject());
    stmt.free();
    return filas;
}

export function obtenerPagoPorReferencia(referencia) {
    const stmt = db.prepare(`SELECT * FROM pagos WHERE referencia = ?`);
    stmt.bind([referencia]);
    const f = filasDe(stmt);
    return f[0] || null;
}

export function listarPagosDeUsuario(usuarioId) {
    const stmt = db.prepare(`SELECT * FROM pagos WHERE usuario_id = ? ORDER BY id DESC`);
    stmt.bind([usuarioId]);
    return filasDe(stmt);
}

export function listarPagosEfectivoPendientes() {
    const stmt = db.prepare(
        `SELECT p.*, u.nombre AS usuario_nombre, u.email AS usuario_email
         FROM pagos p JOIN usuarios u ON u.id = p.usuario_id
         WHERE p.metodo = 'efectivo' AND p.estado = 'pendiente' ORDER BY p.id`
    );
    return filasDe(stmt);
}

/**
 * Pasa un pago de 'pendiente' a otro estado. Solo actúa si SIGUE pendiente
 * (así un mismo pago no se puede confirmar dos veces ni activar el plan dos veces).
 */
export function resolverPagoPendiente(referencia, nuevoEstado, resueltoPor) {
    db.run(
        `UPDATE pagos SET estado = ?, fecha_resolucion = datetime('now'), resuelto_por = ?
         WHERE referencia = ? AND estado = 'pendiente'`,
        [nuevoEstado, resueltoPor ?? null, referencia]
    );
    const cambios = db.getRowsModified();
    guardarEnLocalStorage();
    return cambios === 1;
}

/** Aplica el efecto de un pago aprobado sobre el plan del usuario. */
export function activarPlanPorPago(usuarioId, planTipo, cantidad) {
    const u = buscarUsuarioPorId(usuarioId);
    if (!u) return;
    if (planTipo === 'combo15') {
        if (u.plan_tipo === 'combo15') {
            db.run(`UPDATE usuarios SET creditos_totales = COALESCE(creditos_totales, 0) + 15 WHERE id = ?`, [usuarioId]);
        } else {
            db.run(`UPDATE usuarios SET plan_tipo = 'combo15', creditos_totales = 15, creditos_usados = 0, plan_vence = NULL WHERE id = ?`, [usuarioId]);
        }
    } else if (planTipo === 'premium') {
        // 30 días desde hoy, o desde el vencimiento actual si todavía no venció (renovación).
        const base = (u.plan_tipo === 'premium' && u.plan_vence && new Date(u.plan_vence.replace(' ', 'T') + 'Z') > new Date())
            ? new Date(u.plan_vence.replace(' ', 'T') + 'Z') : new Date();
        base.setUTCDate(base.getUTCDate() + 30);
        db.run(`UPDATE usuarios SET plan_tipo = 'premium', creditos_totales = NULL, plan_vence = ? WHERE id = ?`,
               [base.toISOString().slice(0, 19).replace('T', ' '), usuarioId]);
    } else {
        db.run(`UPDATE usuarios SET plan_tipo = 'hora', creditos_totales = NULL, plan_vence = NULL WHERE id = ?`, [usuarioId]);
    }
    guardarEnLocalStorage();
}
