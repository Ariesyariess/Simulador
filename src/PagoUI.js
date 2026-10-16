import { PRECIOS, calcularMonto, pagarConTarjeta, iniciarPagoEfectivo, confirmarPagoEfectivo,
         anularPagoEfectivo, pagosDelUsuario, pagosEfectivoPendientes } from './Pagos.js';
import { obtenerUsuario, PLAN_LABEL } from './Auth.js';

console.log('[VeloX] PagoUI.js v1 cargado');

const peso = (n) => '$ ' + Number(n).toLocaleString('es-UY');

// Crea elementos con textContent (nunca innerHTML con datos de usuario → sin XSS).
function el(tag, props = {}, ...hijos) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v);
    }
    hijos.flat().forEach(h => h != null && e.append(h));
    return e;
}

const ESTILOS = `
#pago-overlay { position: fixed; inset: 0; z-index: 1100; background: rgba(5,8,18,.88); display: flex;
  align-items: center; justify-content: center; font-family: system-ui, sans-serif; color: #e8eaee; }
#pago-card { width: 560px; max-width: 94vw; max-height: 92vh; overflow-y: auto; background: #141824;
  border: 1px solid #2c3550; border-radius: 14px; padding: 20px 22px; }
#pago-card h2 { margin: 0 0 4px; font-size: 20px; }
#pago-card h3 { margin: 16px 0 6px; font-size: 14px; color: #8fa3c7; text-transform: uppercase; letter-spacing: .04em; }
#pago-card .prueba { background: #3a2a05; border: 1px solid #b8860b; color: #ffd37a; padding: 8px 10px;
  border-radius: 8px; font-size: 13px; margin: 8px 0; }
#pago-card .fila { display: flex; gap: 8px; align-items: center; padding: 6px 0; }
#pago-card label.plan { display: flex; justify-content: space-between; gap: 8px; width: 100%; padding: 8px 10px;
  border: 1px solid #2c3550; border-radius: 8px; cursor: pointer; }
#pago-card label.plan:has(input:checked) { border-color: #4a7dff; background: #1a2440; }
#pago-card input[type=text], #pago-card input[type=password], #pago-card input[type=number] {
  width: 100%; box-sizing: border-box; padding: 9px 10px; background: #0e1220; border: 1px solid #2c3550;
  border-radius: 8px; color: #e8eaee; font-size: 14px; }
#pago-card button { padding: 10px 14px; border: 0; border-radius: 8px; background: #2f5bff; color: #fff;
  font-weight: 600; cursor: pointer; }
#pago-card button.sec { background: #2c3550; }
#pago-card button.peligro { background: #8a2b2b; }
#pago-card button:disabled { opacity: .5; cursor: wait; }
#pago-card .msg { min-height: 20px; margin: 8px 0; font-size: 14px; }
#pago-card .msg.ok { color: #5ee28a; } #pago-card .msg.error { color: #ff7b7b; }
#pago-card .codigo { font: 700 26px monospace; letter-spacing: 2px; background: #0e1220; padding: 10px; border-radius: 8px;
  text-align: center; border: 1px dashed #4a7dff; }
#pago-card table { width: 100%; border-collapse: collapse; font-size: 13px; }
#pago-card td, #pago-card th { padding: 5px 6px; border-bottom: 1px solid #232a40; text-align: left; }
#btn-planes-pagos { position: fixed; top: 56px; right: 12px; z-index: 20; padding: 8px 14px;
  font: 600 14px system-ui, sans-serif; color: #fff; background: rgba(20,35,70,.85); border: 1px solid #c0c5ca;
  border-radius: 8px; cursor: pointer; }
`;

function inyectarEstilos() {
    if (document.getElementById('pago-estilos')) return;
    document.head.append(el('style', { id: 'pago-estilos', text: ESTILOS }));
}

/** Agrega el botón "Planes y pagos" a la pantalla del juego (llamar después del login). */
export function montarBotonPagos(usuario) {
    inyectarEstilos();
    if (document.getElementById('btn-planes-pagos')) return;
    document.body.append(el('button', { id: 'btn-planes-pagos', text: '💳 Planes y pagos',
        onclick: () => abrirPagos(usuario) }));
}

export async function abrirPagos(usuarioInicial) {
    inyectarEstilos();
    document.getElementById('pago-overlay')?.remove();
    let usuario = await obtenerUsuario(usuarioInicial.id) || usuarioInicial;

    let metodo = 'tarjeta';
    const estado = { plan: 'hora', cantidad: 1 };

    const msg = el('div', { class: 'msg', 'aria-live': 'polite' });
    const resumenPlan = el('div');
    const listaPlanes = el('div');
    const cantidadInput = el('input', { type: 'number', min: '1', max: '200', value: '1', id: 'pg-cantidad' });
    const filaCantidad = el('div', { class: 'fila' }, el('span', { text: 'Cantidad de horas:' }), cantidadInput);
    const total = el('div', { class: 'fila', style: 'font-weight:700;font-size:16px' });
    const zonaMetodo = el('div');
    const historial = el('div');
    const admin = el('div');

    function pintarResumen() {
        const t = usuario.planTipo;
        let extra = '';
        if (t === 'combo15') extra = ` · fichas restantes: ${usuario.creditosTotales - usuario.creditosUsados} de ${usuario.creditosTotales}`;
        if (t === 'premium' && usuario.planVence) extra = ` · vence: ${usuario.planVence.slice(0, 10)}`;
        resumenPlan.replaceChildren(el('div', { text: `Plan actual: ${PLAN_LABEL[t] || t}${extra}` }));
    }

    function pintarPlanes() {
        listaPlanes.replaceChildren(...Object.keys(PRECIOS).map(p => {
            const m = calcularMonto(p, estado.cantidad, metodo);
            const radio = el('input', { type: 'radio', name: 'pg-plan', value: p, ...(estado.plan === p ? { checked: '' } : {}),
                onchange: () => { estado.plan = p; refrescar(); } });
            const precio = m.descuento > 0
                ? `${peso(m.total)} (antes ${peso(m.bruto)} · ${m.motivo} −${m.pct}%)`
                : peso(m.total);
            return el('label', { class: 'plan' }, el('span', {}, radio, ' ', PRECIOS[p].etiqueta), el('span', { text: precio }));
        }));
        filaCantidad.style.display = estado.plan === 'hora' ? 'flex' : 'none';
    }

    function setMsg(texto, tipo = '') { msg.className = 'msg ' + tipo; msg.textContent = texto; }

    function pintarMetodo() {
        const m = calcularMonto(estado.plan, estado.cantidad, metodo);
        total.textContent = `Total a pagar: ${peso(m.total)}`;

        const tabs = el('div', { class: 'fila' },
            el('button', { class: metodo === 'tarjeta' ? '' : 'sec', text: '💳 Tarjeta', onclick: () => { metodo = 'tarjeta'; refrescar(); } }),
            el('button', { class: metodo === 'efectivo' ? '' : 'sec', text: '💵 Efectivo', onclick: () => { metodo = 'efectivo'; refrescar(); } }));

        if (metodo === 'tarjeta') {
            const numero = el('input', { type: 'text', inputmode: 'numeric', autocomplete: 'cc-number', maxlength: '23',
                placeholder: 'Número de tarjeta', 'aria-label': 'Número de tarjeta',
                oninput: (e) => { e.target.value = e.target.value.replace(/[^\d]/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim(); } });
            const venc = el('input', { type: 'text', inputmode: 'numeric', autocomplete: 'cc-exp', maxlength: '5',
                placeholder: 'MM/AA', 'aria-label': 'Vencimiento',
                oninput: (e) => { let v = e.target.value.replace(/[^\d]/g, '').slice(0, 4); if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2); e.target.value = v; } });
            const cvv = el('input', { type: 'password', inputmode: 'numeric', autocomplete: 'cc-csc', maxlength: '4',
                placeholder: 'CVV', 'aria-label': 'Código de seguridad' });
            const pagar = el('button', { text: `Pagar ${peso(m.total)}` });
            pagar.addEventListener('click', async () => {
                pagar.disabled = true; setMsg('Procesando…');
                try {
                    const r = await pagarConTarjeta({ usuarioId: usuario.id, planTipo: estado.plan, cantidad: estado.cantidad,
                        tarjeta: { numero: numero.value, vencimiento: venc.value, cvv: cvv.value } });
                    if (r.ok) { setMsg(`Pago aprobado (${r.marca} ····${r.ultimos4}). Código: ${r.referencia}`, 'ok'); await recargarUsuario(); }
                    else setMsg(r.error, 'error');
                } finally {
                    // Los datos de la tarjeta se borran de la pantalla pase lo que pase.
                    numero.value = ''; venc.value = ''; cvv.value = ''; pagar.disabled = false;
                }
            });
            zonaMetodo.replaceChildren(tabs,
                el('div', { class: 'prueba', text: 'MODO PRUEBA: no ingreses tarjetas reales. Usá la de prueba 4111 1111 1111 1111 · vence 12/40 · CVV 123. (Rechazo: 4000 0000 0000 0002)' }),
                numero, el('div', { class: 'fila' }, venc, cvv), pagar);
        } else {
            const generar = el('button', { text: 'Generar código de pago' });
            const salida = el('div');
            generar.addEventListener('click', async () => {
                generar.disabled = true;
                try {
                    const r = await iniciarPagoEfectivo({ usuarioId: usuario.id, planTipo: estado.plan, cantidad: estado.cantidad });
                    if (!r.ok) { setMsg(r.error, 'error'); return; }
                    setMsg('Orden generada.', 'ok');
                    salida.replaceChildren(el('div', { class: 'codigo', text: r.referencia }),
                        el('p', { text: `Presentá este código y abonás ${peso(r.total)} en efectivo en el local de VeloX. Tu plan se activa cuando un administrador confirma el cobro.` }));
                    await pintarHistorial();
                } finally { generar.disabled = false; }
            });
            zonaMetodo.replaceChildren(tabs, generar, salida);
        }
    }

    async function pintarHistorial() {
        const pagos = await pagosDelUsuario(usuario.id);
        historial.replaceChildren(
            pagos.length === 0 ? el('p', { text: 'Todavía no hay pagos.' }) :
            el('table', {}, el('thead', {}, el('tr', {}, ...['Código', 'Plan', 'Método', 'Monto', 'Estado'].map(h => el('th', { text: h })))),
                el('tbody', {}, ...pagos.map(p => el('tr', {},
                    el('td', { text: p.referencia }), el('td', { text: PRECIOS[p.plan_tipo]?.etiqueta || p.plan_tipo }),
                    el('td', { text: p.metodo === 'tarjeta' ? `Tarjeta ····${p.tarjeta_ultimos4 || ''}` : 'Efectivo' }),
                    el('td', { text: peso(p.monto_uyu) }), el('td', { text: p.estado }))))));
    }

    async function pintarAdmin() {
        if (usuario.rol !== 'admin') { admin.replaceChildren(); return; }
        const pend = await pagosEfectivoPendientes(usuario.id);
        admin.replaceChildren(el('h3', { text: 'Administración: cobros en efectivo pendientes' }),
            ...(pend.length === 0 ? [el('p', { text: 'No hay órdenes pendientes.' })] :
            pend.map(p => el('div', { class: 'fila' },
                el('span', { text: `${p.referencia} · ${p.usuario_nombre} · ${peso(p.monto_uyu)} · ${PRECIOS[p.plan_tipo]?.etiqueta || p.plan_tipo}`, style: 'flex:1' }),
                el('button', { text: 'Confirmar cobro', onclick: async () => {
                    const r = await confirmarPagoEfectivo({ adminId: usuario.id, referencia: p.referencia });
                    setMsg(r.ok ? 'Cobro confirmado y plan activado.' : r.error, r.ok ? 'ok' : 'error'); refrescar(); } }),
                el('button', { class: 'peligro', text: 'Anular', onclick: async () => {
                    const r = await anularPagoEfectivo({ adminId: usuario.id, referencia: p.referencia });
                    setMsg(r.ok ? 'Orden anulada.' : r.error, r.ok ? 'ok' : 'error'); refrescar(); } })))));
    }

    async function recargarUsuario() { usuario = await obtenerUsuario(usuario.id) || usuario; await refrescar(); }
    async function refrescar() { pintarResumen(); pintarPlanes(); pintarMetodo(); await pintarHistorial(); await pintarAdmin(); }

    cantidadInput.addEventListener('input', () => { estado.cantidad = Math.max(1, Math.min(200, parseInt(cantidadInput.value, 10) || 1)); refrescar(); });

    const overlay = el('div', { id: 'pago-overlay' },
        el('div', { id: 'pago-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Planes y pagos' },
            el('div', { class: 'fila' }, el('h2', { text: 'Planes y pagos', style: 'flex:1' }),
                el('button', { class: 'sec', text: 'Cerrar', onclick: () => overlay.remove() })),
            resumenPlan, el('h3', { text: 'Elegí tu plan' }), listaPlanes, filaCantidad, total,
            el('h3', { text: 'Forma de pago' }), zonaMetodo, msg,
            el('h3', { text: 'Mis pagos' }), historial, admin));
    document.body.append(overlay);
    await refrescar();
}
