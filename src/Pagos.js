import {
    initDB, crearPago, obtenerPagoPorReferencia, listarPagosDeUsuario,
    listarPagosEfectivoPendientes, resolverPagoPendiente, activarPlanPorPago,
    buscarUsuarioPorId, registrarAuditoria, contarAuditoriaReciente
} from './Database.js';

console.log('[VeloX] Pagos.js v1 cargado');

// ───────────────────────────── Precios (UYU) ─────────────────────────────
// Salen del plan de negocio de VeloX (documento de Emprendedurismo).
export const PRECIOS = {
    hora:    { lista: 800,   etiqueta: 'Clase por hora (1 hora)' },
    combo15: { lista: 12000, etiqueta: 'Combo 15 clases' },
    premium: { lista: 24000, etiqueta: 'Premium: suscripción mensual ilimitada' },
};
const DESCUENTO_HORAS_PCT = 15;     // si compra más de 10 horas
const DESCUENTO_CONTADO_PCT = 10;   // combo 15 pagado al contado (en efectivo)
const PROMO_PREMIUM_ACTIVA = true;  // promo de lanzamiento: 40% (queda en $14.400)
const PROMO_PREMIUM_PCT = 40;

/** Calcula el monto con números enteros (sin decimales). */
export function calcularMonto(planTipo, cantidad = 1, metodo = 'tarjeta') {
    if (!PRECIOS[planTipo]) return null;
    let cant = Math.floor(Number(cantidad)) || 1;
    cant = Math.min(Math.max(cant, 1), 200);
    if (planTipo !== 'hora') cant = 1;

    const bruto = PRECIOS[planTipo].lista * cant;
    let pct = 0;
    let motivo = '';
    if (planTipo === 'hora' && cant > 10) { pct = DESCUENTO_HORAS_PCT; motivo = 'Descuento por más de 10 horas'; }
    if (planTipo === 'combo15' && metodo === 'efectivo') { pct = DESCUENTO_CONTADO_PCT; motivo = 'Descuento por pago al contado'; }
    if (planTipo === 'premium' && PROMO_PREMIUM_ACTIVA) { pct = PROMO_PREMIUM_PCT; motivo = 'Promo de lanzamiento'; }

    const descuento = Math.round(bruto * pct / 100);
    return { planTipo, cantidad: cant, bruto, descuento, total: bruto - descuento, pct, motivo };
}

// ──────────────────────────── Tarjeta (solo validar) ────────────────────────────
// Estas funciones validan y descartan: el número y el CVV no se guardan en ningún lado.

function luhn(numero) {
    let suma = 0, doble = false;
    for (let i = numero.length - 1; i >= 0; i--) {
        let d = numero.charCodeAt(i) - 48;
        if (doble) { d *= 2; if (d > 9) d -= 9; }
        suma += d;
        doble = !doble;
    }
    return suma % 10 === 0;
}

export function detectarMarca(pan) {
    if (/^4/.test(pan)) return 'visa';
    if (/^(5[1-5]|2(2[2-9][1-9]|2[3-9]\d|[3-6]\d\d|7[01]\d|720))/.test(pan)) return 'mastercard';
    if (/^3[47]/.test(pan)) return 'amex';
    return 'otra';
}

/** @returns {{ok:boolean, error?:string, marca?:string, ultimos4?:string}} */
export function validarTarjeta({ numero, vencimiento, cvv }) {
    const pan = String(numero || '').replace(/[\s-]/g, '');
    if (!/^\d{13,19}$/.test(pan) || !luhn(pan)) return { ok: false, error: 'El número de tarjeta no es válido.' };

    const m = String(vencimiento || '').trim().match(/^(\d{2})\s*\/\s*(\d{2}|\d{4})$/);
    if (!m) return { ok: false, error: 'El vencimiento debe tener el formato MM/AA.' };
    const mes = Number(m[1]);
    const anio = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
    const hoy = new Date();
    if (mes < 1 || mes > 12) return { ok: false, error: 'El mes de vencimiento no es válido.' };
    if (anio < hoy.getFullYear() || (anio === hoy.getFullYear() && mes < hoy.getMonth() + 1)) {
        return { ok: false, error: 'La tarjeta está vencida.' };
    }

    const marca = detectarMarca(pan);
    const largoCvv = marca === 'amex' ? 4 : 3;
    if (!new RegExp(`^\\d{${largoCvv}}$`).test(String(cvv || ''))) {
        return { ok: false, error: `El código de seguridad debe tener ${largoCvv} dígitos.` };
    }
    return { ok: true, marca, ultimos4: pan.slice(-4) };
}

// ───────────────────────── Pasarela de pago SIMULADA ─────────────────────────
// En producción esto NO existe en nuestro código: el cliente escribe la tarjeta
// en un formulario alojado por la pasarela (Mercado Pago, etc.) y a nosotros
// solo nos llega un token + el resultado. Acá se simula ese resultado.
// Solo acepta tarjetas de PRUEBA públicas: así, si alguien escribe una tarjeta
// real por error, el sistema la rechaza sin procesarla.
const TARJETAS_DE_PRUEBA = {
    '4111111111111111': 'aprobada',          // Visa de prueba
    '5555555555554444': 'aprobada',          // Mastercard de prueba
    '378282246310005':  'aprobada',          // Amex de prueba
    '4000000000000002': 'rechazada',         // rechazo genérico
    '4000000000009995': 'fondos_insuficientes',
};

function aleatorio(alfabeto, largo) {
    const bytes = crypto.getRandomValues(new Uint8Array(largo));
    return Array.from(bytes, b => alfabeto[b % alfabeto.length]).join('');
}
const ALFABETO_REF = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 símbolos, sin I/O/0/1 para no confundir

export function generarReferencia() { return 'VX-' + aleatorio(ALFABETO_REF, 8); }

async function pasarelaSimulada(numero) {
    await new Promise(r => setTimeout(r, 700)); // latencia de red simulada
    const pan = String(numero).replace(/[\s-]/g, '');
    const resultado = TARJETAS_DE_PRUEBA[pan];
    if (!resultado) return { aprobado: false, codigo: 'no_es_tarjeta_de_prueba' };
    if (resultado !== 'aprobada') return { aprobado: false, codigo: resultado };
    return { aprobado: true, codigo: 'aprobada', token: 'tok_test_' + aleatorio(ALFABETO_REF, 16) };
}

const MENSAJES_RECHAZO = {
    rechazada: 'La tarjeta fue rechazada por el banco.',
    fondos_insuficientes: 'Fondos insuficientes.',
    no_es_tarjeta_de_prueba: 'Versión de prueba: solo se aceptan tarjetas de prueba. No ingreses tarjetas reales.',
};

// ───────────────────────────── Operaciones ─────────────────────────────

const MAX_FALLOS_TARJETA = 3;      // por usuario...
const VENTANA_MIN = 10;            // ...cada 10 minutos
const MAX_EFECTIVO_PENDIENTES = 3;

/** Pago con tarjeta. `tarjeta` = { numero, vencimiento, cvv }: se usa y se descarta. */
export async function pagarConTarjeta({ usuarioId, planTipo, cantidad = 1, tarjeta }) {
    await initDB();
    const usuario = buscarUsuarioPorId(usuarioId);
    if (!usuario) return { ok: false, error: 'Usuario no encontrado.' };

    const monto = calcularMonto(planTipo, cantidad, 'tarjeta');
    if (!monto) return { ok: false, error: 'Plan inválido.' };

    if (contarAuditoriaReciente(usuarioId, 'PAGO_TARJETA_FALLIDO', VENTANA_MIN) >= MAX_FALLOS_TARJETA) {
        return { ok: false, error: 'Demasiados intentos fallidos. Esperá unos minutos antes de volver a intentar.' };
    }

    const v = validarTarjeta(tarjeta || {});
    if (!v.ok) {
        registrarAuditoria(usuarioId, 'PAGO_TARJETA_FALLIDO', 'datos_invalidos');
        return { ok: false, error: v.error };
    }

    const respuesta = await pasarelaSimulada(tarjeta.numero);
    const referencia = generarReferencia();

    crearPago({
        usuarioId, planTipo, cantidad: monto.cantidad, montoUyu: monto.total, descuentoUyu: monto.descuento,
        metodo: 'tarjeta', estado: respuesta.aprobado ? 'aprobado' : 'rechazado', referencia,
        tarjetaMarca: v.marca, tarjetaUltimos4: v.ultimos4, tokenPasarela: respuesta.token || null,
    });

    if (!respuesta.aprobado) {
        registrarAuditoria(usuarioId, 'PAGO_TARJETA_FALLIDO', `ref=${referencia};codigo=${respuesta.codigo}`);
        return { ok: false, error: MENSAJES_RECHAZO[respuesta.codigo] || 'No se pudo procesar el pago.' };
    }

    activarPlanPorPago(usuarioId, planTipo, monto.cantidad);
    registrarAuditoria(usuarioId, 'PAGO_TARJETA_APROBADO', `ref=${referencia};total=${monto.total}`);
    return { ok: true, referencia, total: monto.total, marca: v.marca, ultimos4: v.ultimos4 };
}

/** Pago en efectivo: genera una orden con código; queda pendiente hasta que un administrador cobre. */
export async function iniciarPagoEfectivo({ usuarioId, planTipo, cantidad = 1 }) {
    await initDB();
    if (!buscarUsuarioPorId(usuarioId)) return { ok: false, error: 'Usuario no encontrado.' };

    const monto = calcularMonto(planTipo, cantidad, 'efectivo');
    if (!monto) return { ok: false, error: 'Plan inválido.' };

    const pendientes = listarPagosDeUsuario(usuarioId).filter(p => p.metodo === 'efectivo' && p.estado === 'pendiente');
    if (pendientes.length >= MAX_EFECTIVO_PENDIENTES) {
        return { ok: false, error: 'Ya tenés órdenes de pago pendientes. Abonalas o esperá a que se anulen.' };
    }

    const referencia = generarReferencia();
    crearPago({
        usuarioId, planTipo, cantidad: monto.cantidad, montoUyu: monto.total, descuentoUyu: monto.descuento,
        metodo: 'efectivo', estado: 'pendiente', referencia,
    });
    registrarAuditoria(usuarioId, 'PAGO_EFECTIVO_GENERADO', `ref=${referencia};total=${monto.total}`);
    return { ok: true, referencia, total: monto.total, monto };
}

function exigirAdmin(adminId, accion) {
    const admin = buscarUsuarioPorId(adminId);
    if (!admin || admin.rol !== 'admin') {
        registrarAuditoria(adminId, 'ACCESO_DENEGADO', accion);
        return null;
    }
    return admin;
}

/** El administrador confirma que cobró el efectivo. Activa el plan una sola vez. */
export async function confirmarPagoEfectivo({ adminId, referencia }) {
    await initDB();
    if (!exigirAdmin(adminId, 'confirmar_pago')) return { ok: false, error: 'No tenés permisos de administrador.' };

    const pago = obtenerPagoPorReferencia(referencia);
    if (!pago || pago.metodo !== 'efectivo') return { ok: false, error: 'No existe una orden en efectivo con ese código.' };
    if (pago.estado !== 'pendiente') return { ok: false, error: 'Esa orden ya fue resuelta.' };
    // Separación de funciones: nadie confirma su propio pago.
    if (pago.usuario_id === adminId) return { ok: false, error: 'Un administrador no puede confirmar su propio pago.' };

    if (!resolverPagoPendiente(referencia, 'aprobado', adminId)) return { ok: false, error: 'Esa orden ya fue resuelta.' };
    activarPlanPorPago(pago.usuario_id, pago.plan_tipo, pago.cantidad);
    registrarAuditoria(adminId, 'PAGO_EFECTIVO_CONFIRMADO', `ref=${referencia};usuario=${pago.usuario_id}`);
    return { ok: true };
}

export async function anularPagoEfectivo({ adminId, referencia }) {
    await initDB();
    if (!exigirAdmin(adminId, 'anular_pago')) return { ok: false, error: 'No tenés permisos de administrador.' };
    if (!resolverPagoPendiente(referencia, 'anulado', adminId)) return { ok: false, error: 'La orden no existe o ya fue resuelta.' };
    registrarAuditoria(adminId, 'PAGO_EFECTIVO_ANULADO', `ref=${referencia}`);
    return { ok: true };
}

export async function pagosDelUsuario(usuarioId) { await initDB(); return listarPagosDeUsuario(usuarioId); }

export async function pagosEfectivoPendientes(adminId) {
    await initDB();
    if (!exigirAdmin(adminId, 'listar_pendientes')) return [];
    return listarPagosEfectivoPendientes();
}
