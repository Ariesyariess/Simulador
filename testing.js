const resultados = {
  fecha: new Date().toLocaleString(),
  fpsPromedio: 0,
  errores: [],
  eventos: []
};

// Contadores para teclas y clicks
const contadorTeclas = {};
const contadorClicks = {};

// Captura de errores
window.addEventListener("error", (e) => {
  resultados.errores.push(e.message);
});

// Captura de teclas
document.addEventListener("keydown", (e) => {
  if (!contadorTeclas[e.key]) contadorTeclas[e.key] = 0;
  contadorTeclas[e.key]++;
});

// Captura de clicks
document.addEventListener("click", (e) => {
  const pos = `X:${e.clientX},Y:${e.clientY}`;
  if (!contadorClicks[pos]) contadorClicks[pos] = 0;
  contadorClicks[pos]++;
});

// Captura de scroll
window.addEventListener("scroll", () => {
  resultados.eventos.push("Scroll detectado");
});

// Captura de carga inicial
window.addEventListener("load", () => {
  resultados.eventos.push("Página cargada");
});

// --- Cálculo de FPS promedio ---
let frames = 0;
let inicio = performance.now();

function contarFrames() {
  frames++;
  requestAnimationFrame(contarFrames);
}
contarFrames();

window.addEventListener("beforeunload", () => {
  const fin = performance.now();
  const segundos = (fin - inicio) / 1000;
  resultados.fpsPromedio = (frames / segundos).toFixed(2);

  // Resumir teclas
  for (const [tecla, cantidad] of Object.entries(contadorTeclas)) {
    resultados.eventos.push(`Tecla: ${tecla} (x${cantidad})`);
  }

  // Resumir clicks
  for (const [pos, cantidad] of Object.entries(contadorClicks)) {
    resultados.eventos.push(`Click en ${pos} (x${cantidad})`);
  }

  // Guardar en JSON
  fetch("guardar_testing.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(resultados),
  });

  // Guardar en CSV
  fetch("guardar_testing_csv.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(resultados),
  });
});
