import { registrarUsuario, iniciarSesion, PLANES, PLAN_LABEL } from './Auth.js';

const ESTILOS = `
#login-overlay {
    position: fixed; inset: 0; z-index: 1000;
    display: flex; align-items: center; justify-content: center;
    background: radial-gradient(circle at 50% 30%, #1b2a4a 0%, #0a0e1a 100%);
    font-family: system-ui, sans-serif; color: #e8eaee;
}
#login-card {
    width: 340px; max-width: 90vw; padding: 28px 26px;
    background: rgba(20, 24, 36, 0.92); border: 1px solid #2c3550;
    border-radius: 14px; box-shadow: 0 10px 40px rgba(0,0,0,0.5);
}
#login-card h1 { font-size: 20px; margin: 0 0 4px; text-align: center; }
#login-card p.sub { margin: 0 0 20px; text-align: center; color: #8b93a7; font-size: 13px; }
#login-card input {
    width: 100%; box-sizing: border-box; padding: 10px 12px; margin-bottom: 10px;
    background: #0e1220; border: 1px solid #2c3550; border-radius: 8px;
    color: #e8eaee; font-size: 14px;
}
#login-card input:focus { outline: none; border-color: #4a7dff; }
#login-card button {
    width: 100%; padding: 11px; margin-top: 6px; border: none; border-radius: 8px;
    background: #2f5bff; color: #fff; font-weight: 600; font-size: 14px; cursor: pointer;
}
#login-card button:hover { background: #4a71ff; }
#login-card button.secundario {
    background: transparent; color: #8fa3c7; margin-top: 10px; font-weight: 500;
}
#login-card button.secundario:hover { background: rgba(255,255,255,0.05); }
#login-error {
    min-height: 18px; margin: 4px 0 10px; font-size: 13px; color: #ff6b6b; text-align: center;
}
#login-tabs { display: flex; margin-bottom: 18px; border-radius: 8px; overflow: hidden; border: 1px solid #2c3550; }
#login-tabs button {
    flex: 1; margin: 0; border-radius: 0; background: #0e1220; color: #8b93a7;
}
#login-tabs button.activo { background: #2f5bff; color: #fff; }
#login-card .campo-opcional { color: #8b93a7; font-size: 12px; margin: -6px 0 10px 2px; }
#login-card fieldset {
    border: 1px solid #2c3550; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px;
}
#login-card legend { padding: 0 6px; color: #8fa3c7; font-size: 13px; }
#login-card .plan-opcion { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 14px; }
#login-card .plan-opcion input { width: auto; margin: 0; }
`;

function inyectarEstilos() {
    if (document.getElementById('login-estilos')) return;
    const style = document.createElement('style');
    style.id = 'login-estilos';
    style.textContent = ESTILOS;
    document.head.appendChild(style);
}

/**
 * Muestra la pantalla de login/registro a pantalla completa.
 * Al autenticarse correctamente, la oculta y llama a onSuccess(usuario).
 */
export function mostrarLogin(onSuccess) {
    inyectarEstilos();

    const overlay = document.createElement('div');
    overlay.id = 'login-overlay';
    overlay.innerHTML = `
        <div id="login-card">
            <h1>🚗 Simulador de Manejo</h1>
            <p class="sub">Iniciá sesión o registrate para empezar</p>

            <div id="login-tabs">
                <button type="button" data-tab="login" class="activo">Iniciar sesión</button>
                <button type="button" data-tab="registro">Registrarme</button>
            </div>

            <div id="login-error"></div>

            <form id="form-login">
                <input type="email" id="li-email" placeholder="Correo electrónico" autocomplete="username" required>
                <input type="password" id="li-password" placeholder="Contraseña" autocomplete="current-password" required>
                <button type="submit">Entrar</button>
            </form>

            <form id="form-registro" style="display:none">
                <input type="text" id="re-nombre" placeholder="Nombre completo" autocomplete="name" required>
                <input type="email" id="re-email" placeholder="Correo electrónico" autocomplete="username" required>
                <input type="text" id="re-cedula" placeholder="Cédula (opcional)" autocomplete="off">
                <div class="campo-opcional">La cédula es opcional, el correo es obligatorio.</div>
                <input type="password" id="re-password" placeholder="Contraseña (mín. 8, letras y números)" autocomplete="new-password" required>

                <fieldset>
                    <legend>Plan de clases</legend>
                    ${PLANES.map((p, i) => `
                        <label class="plan-opcion">
                            <input type="radio" name="re-plan" value="${p}" ${i === 0 ? 'checked' : ''}>
                            ${PLAN_LABEL[p]}
                        </label>
                    `).join('')}
                </fieldset>

                <button type="submit">Crear cuenta</button>
            </form>
        </div>
    `;
    document.body.appendChild(overlay);

    const errorBox      = overlay.querySelector('#login-error');
    const tabs           = overlay.querySelectorAll('#login-tabs button');
    const formLogin      = overlay.querySelector('#form-login');
    const formRegistro   = overlay.querySelector('#form-registro');

    function mostrarError(msg) { errorBox.textContent = msg || ''; }

    tabs.forEach(tab => tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('activo'));
        tab.classList.add('activo');
        mostrarError('');
        const esLogin = tab.dataset.tab === 'login';
        formLogin.style.display    = esLogin ? 'block' : 'none';
        formRegistro.style.display = esLogin ? 'none'  : 'block';
    }));

    function cerrarYContinuar(usuario) {
        overlay.remove();
        onSuccess(usuario);
    }

    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        mostrarError('');
        const boton = formLogin.querySelector('button');
        boton.disabled = true;
        try {
            const res = await iniciarSesion({
                email: overlay.querySelector('#li-email').value,
                password: overlay.querySelector('#li-password').value,
            });
            if (res.ok) cerrarYContinuar(res.usuario);
            else mostrarError(res.error);
        } finally {
            boton.disabled = false;
        }
    });

    formRegistro.addEventListener('submit', async (e) => {
        e.preventDefault();
        mostrarError('');
        const boton = formRegistro.querySelector('button');
        boton.disabled = true;
        try {
            const planElegido = overlay.querySelector('input[name="re-plan"]:checked');
            const res = await registrarUsuario({
                nombre: overlay.querySelector('#re-nombre').value,
                email: overlay.querySelector('#re-email').value,
                cedulaRaw: overlay.querySelector('#re-cedula').value,
                password: overlay.querySelector('#re-password').value,
                planTipo: planElegido ? planElegido.value : null,
            });
            if (res.ok) cerrarYContinuar(res.usuario);
            else mostrarError(res.error);
        } finally {
            boton.disabled = false;
        }
    });
}
