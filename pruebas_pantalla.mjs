import initSqlJsReal from 'sql.js';
import path from 'path';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { pretendToBeVisual: true });
globalThis.window = dom.window; globalThis.document = dom.window.document;
const store = {};
globalThis.localStorage = { getItem:k=>store[k]??null, setItem:(k,v)=>{store[k]=String(v)}, removeItem:k=>{delete store[k]} };
globalThis.initSqlJs = ()=>initSqlJsReal({locateFile:f=>path.resolve('node_modules/sql.js/dist',f)});

const A = await import('../src/Auth.js'); const UI = await import('../src/PagoUI.js'); const D = await import('../src/Database.js');
let ok=0,fail=0; const t=(n,c)=>{c?ok++:fail++;console.log(c?'  OK  ':'  FALLA',n)};
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const set=(el,v)=>{el.value=v; el.dispatchEvent(new window.Event('input',{bubbles:true}));};

const u = (await A.registrarUsuario({nombre:'Ana <script>x</script>',email:'ana@test.uy',cedulaRaw:'',password:'Clave1234',planTipo:'hora'})).usuario;
const adm = (await A.registrarUsuario({nombre:'Admin',email:'admin@velox.test',cedulaRaw:'',password:'Clave1234',planTipo:'hora'})).usuario;

await UI.abrirPagos(u);
const card = document.getElementById('pago-card');
t('abre el modal', !!card);
t('el nombre con <script> no se interpreta como HTML', document.querySelectorAll('#pago-card script').length===0);
t('muestra el aviso de MODO PRUEBA', /MODO PRUEBA/.test(card.textContent));
const radios=[...card.querySelectorAll('input[name=pg-plan]')];
t('muestra los 3 planes', radios.length===3);
radios.find(r=>r.value==='combo15').click(); await sleep(50);
t('combo15 muestra $ 12.000', /12\.000/.test(card.textContent));
const inputs=[...card.querySelectorAll('input[type=text],input[type=password]')];
const [num,venc,cvv]=[inputs.find(i=>i.placeholder==='Número de tarjeta'),inputs.find(i=>i.placeholder==='MM/AA'),inputs.find(i=>i.placeholder==='CVV')];
t('el CVV se muestra enmascarado (password)', cvv.type==='password');
set(num,'4111111111111111'); set(venc,'1240'); set(cvv,'123');
t('formatea número en grupos de 4', num.value==='4111 1111 1111 1111');
t('formatea vencimiento MM/AA', venc.value==='12/40');
[...card.querySelectorAll('button')].find(b=>/^Pagar/.test(b.textContent)).click();
await sleep(1500);
t('muestra pago aprobado', /Pago aprobado/.test(card.textContent));
const num2=[...document.querySelectorAll('#pago-card input')].filter(i=>i.placeholder==='Número de tarjeta');
t('tras pagar, los campos de tarjeta quedan vacíos', num2.every(i=>i.value===''));
const sinAyuda = card.cloneNode(true); sinAyuda.querySelectorAll('.prueba').forEach(n=>n.remove());
t('el número completo no queda en pantalla ni en ningún campo', !sinAyuda.textContent.includes('4111') && [...card.querySelectorAll('input')].every(i=>!/\d{8}/.test(i.value)));
t('el historial muestra ····1111', /····1111/.test(card.textContent));
t('el plan actual pasó a combo15 con 15 fichas', /Combo 15 clases.*15 de 15/.test(card.textContent));
t('un usuario común NO ve el panel de administración', !/Administración/.test(card.textContent));

// efectivo
[...card.querySelectorAll('button')].find(b=>/Efectivo/.test(b.textContent)).click(); await sleep(50);
[...card.querySelectorAll('button')].find(b=>/Generar código/.test(b.textContent)).click(); await sleep(300);
t('genera código VX- en pantalla', /VX-[A-Z2-9]{8}/.test(card.querySelector('.codigo')?.textContent||''));

// admin
document.getElementById('pago-overlay').remove();
await UI.abrirPagos(adm);
const c2=document.getElementById('pago-card');
t('el admin ve el panel de administración', /Administración/.test(c2.textContent));
t('el admin ve la orden pendiente de Ana', /VX-/.test(c2.textContent) && /Ana/.test(c2.textContent));
[...c2.querySelectorAll('button')].find(b=>/Confirmar cobro/.test(b.textContent)).click(); await sleep(400);
t('confirmar cobro funciona', /Cobro confirmado/.test(c2.textContent));
console.log('\nResultado UI:',ok,'OK,',fail,'fallas'); process.exit(fail?1:0);
