import initSqlJsReal from 'sql.js';
import path from 'path';
const store = {};
globalThis.localStorage = { getItem:k=>store[k]??null, setItem:(k,v)=>{store[k]=String(v)}, removeItem:k=>{delete store[k]} };
globalThis.initSqlJs = (o)=>initSqlJsReal({locateFile:f=>path.resolve('node_modules/sql.js/dist',f)});

const A = await import('../src/Auth.js');
const P = await import('../src/Pagos.js');
const D = await import('../src/Database.js');

let ok=0, fail=0;
const t=(nombre,cond)=>{ if(cond){ok++;console.log('  OK  ',nombre)}else{fail++;console.log('  FALLA',nombre)} };

console.log('— Precios');
t('hora x1 = 800', P.calcularMonto('hora',1).total===800);
t('hora x11 = 15% off → 7480', P.calcularMonto('hora',11).total===7480);
t('combo15 tarjeta = 12000', P.calcularMonto('combo15',1,'tarjeta').total===12000);
t('combo15 efectivo (contado) = 10800', P.calcularMonto('combo15',1,'efectivo').total===10800);
t('premium con promo = 14400', P.calcularMonto('premium').total===14400);
t('plan inválido → null', P.calcularMonto('gratis')===null);

console.log('— Validación de tarjeta');
t('Visa de prueba válida', P.validarTarjeta({numero:'4111 1111 1111 1111',vencimiento:'12/40',cvv:'123'}).ok);
t('Luhn inválido rechazado', !P.validarTarjeta({numero:'4111111111111112',vencimiento:'12/40',cvv:'123'}).ok);
t('tarjeta vencida rechazada', !P.validarTarjeta({numero:'4111111111111111',vencimiento:'01/20',cvv:'123'}).ok);
t('CVV corto rechazado', !P.validarTarjeta({numero:'4111111111111111',vencimiento:'12/40',cvv:'12'}).ok);
t('Amex exige CVV de 4', !P.validarTarjeta({numero:'378282246310005',vencimiento:'12/40',cvv:'123'}).ok && P.validarTarjeta({numero:'378282246310005',vencimiento:'12/40',cvv:'1234'}).ok);
t('validar no devuelve el número completo', !JSON.stringify(P.validarTarjeta({numero:'4111111111111111',vencimiento:'12/40',cvv:'123'})).includes('4111111111111111'));

console.log('— Contraseñas');
const h1 = await A.hashPassword('Clave1234'); const h2 = await A.hashPassword('Clave1234');
t('formato pbkdf2$iter$sal$hash', /^pbkdf2\$600000\$/.test(h1));
t('misma clave → hashes distintos (sal por usuario)', h1!==h2);
t('verifica clave correcta', await A.verificarPassword('Clave1234',h1));
t('rechaza clave incorrecta', !(await A.verificarPassword('Clave1235',h1)));
t('no guarda la clave en claro', !h1.includes('Clave1234'));

console.log('— Registro y login');
const r1 = await A.registrarUsuario({nombre:'Ana Test',email:'ana@test.uy',cedulaRaw:'',password:'Clave1234',planTipo:'hora'});
t('registra usuario', r1.ok && r1.usuario.rol==='usuario');
const rAdmin = await A.registrarUsuario({nombre:'Admin',email:'admin@velox.test',cedulaRaw:'',password:'Clave1234',planTipo:'premium'});
t('correo de administrador recibe rol admin', rAdmin.ok && rAdmin.usuario.rol==='admin');
t('correo duplicado rechazado', !(await A.registrarUsuario({nombre:'Ana 2',email:'ana@test.uy',cedulaRaw:'',password:'Clave1234',planTipo:'hora'})).ok);
t('login correcto', (await A.iniciarSesion({email:'ana@test.uy',password:'Clave1234'})).ok);
for (let i=0;i<5;i++) await A.iniciarSesion({email:'ana@test.uy',password:'mala'+i});
const bloq = await A.iniciarSesion({email:'ana@test.uy',password:'Clave1234'});
t('tras 5 fallos queda bloqueado aunque la clave sea correcta', !bloq.ok && /intentos/.test(bloq.error));

console.log('— Pago con tarjeta');
const ana = r1.usuario, adm = rAdmin.usuario;
const bueno = await P.pagarConTarjeta({usuarioId:ana.id,planTipo:'combo15',tarjeta:{numero:'4111111111111111',vencimiento:'12/40',cvv:'123'}});
t('tarjeta de prueba aprobada', bueno.ok && bueno.total===12000);
let u = D.buscarUsuarioPorId(ana.id);
t('activa combo15 con 15 fichas', u.plan_tipo==='combo15' && u.creditos_totales===15);
const real = await P.pagarConTarjeta({usuarioId:adm.id,planTipo:'hora',tarjeta:{numero:'4242424242424242',vencimiento:'12/40',cvv:'123'}});
t('tarjeta que NO es de prueba se rechaza sin procesar', !real.ok && /prueba/.test(real.error));
const pagos = D.listarPagosDeUsuario(ana.id);
const filaCruda = JSON.stringify(pagos);
t('en la base NO está el número completo', !filaCruda.includes('4111111111111111'));
t('en la base NO está el CVV ni el vencimiento', !/cvv|"123"|12\/40/i.test(filaCruda));
t('en la base sí quedan marca y últimos 4', pagos[0].tarjeta_marca==='visa' && pagos[0].tarjeta_ultimos4==='1111');
const dump = JSON.stringify(D.listarAuditoria(500));
t('la auditoría no contiene datos de tarjeta', !dump.includes('4111') && !dump.includes('cvv'));
for (let i=0;i<3;i++) await P.pagarConTarjeta({usuarioId:adm.id,planTipo:'hora',tarjeta:{numero:'4000000000000002',vencimiento:'12/40',cvv:'123'}});
const lim = await P.pagarConTarjeta({usuarioId:adm.id,planTipo:'hora',tarjeta:{numero:'4111111111111111',vencimiento:'12/40',cvv:'123'}});
t('3 fallos seguidos bloquean nuevos intentos', !lim.ok && /intentos/.test(lim.error));

console.log('— Pago en efectivo');
const bob = (await A.registrarUsuario({nombre:'Bob',email:'bob@test.uy',cedulaRaw:'',password:'Clave1234',planTipo:'hora'})).usuario;
const orden = await P.iniciarPagoEfectivo({usuarioId:bob.id,planTipo:'combo15'});
t('genera orden pendiente con código VX-', orden.ok && /^VX-[A-Z2-9]{8}$/.test(orden.referencia) && orden.total===10800);
t('el plan NO se activa hasta cobrar', D.buscarUsuarioPorId(bob.id).plan_tipo==='hora');
const noAdmin = await P.confirmarPagoEfectivo({adminId:ana.id,referencia:orden.referencia});
t('un usuario común no puede confirmar', !noAdmin.ok);
const propio = await P.iniciarPagoEfectivo({usuarioId:adm.id,planTipo:'hora'});
t('el admin no puede confirmar su propio pago', !(await P.confirmarPagoEfectivo({adminId:adm.id,referencia:propio.referencia})).ok);
const conf = await P.confirmarPagoEfectivo({adminId:adm.id,referencia:orden.referencia});
t('el admin confirma y se activa combo15', conf.ok && D.buscarUsuarioPorId(bob.id).plan_tipo==='combo15');
const otra = await P.confirmarPagoEfectivo({adminId:adm.id,referencia:orden.referencia});
t('no se puede confirmar dos veces (no duplica fichas)', !otra.ok && D.buscarUsuarioPorId(bob.id).creditos_totales===15);
t('usuario común no ve los pendientes', (await P.pagosEfectivoPendientes(ana.id)).length===0);
t('la auditoría registró el acceso denegado', D.listarAuditoria(500).some(a=>a.accion==='ACCESO_DENEGADO'));

console.log('— Fichas del combo');
const g = D.iniciarSesionDeJuego(bob.id);
t('jugar gasta 1 ficha (quedan 14)', g.ok && g.restantes===14);

console.log('\nResultado:', ok, 'OK,', fail, 'fallas');
process.exit(fail?1:0);
