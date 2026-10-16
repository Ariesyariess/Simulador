// testing.js
const resultados = {
  fecha: new Date().toLocaleString(),
  fpsPromedio: 0,
  errores: [],
  eventos: []
};

// Captura de errores
window.addEventListener("error", (e) => {
  resultados.errores.push(e.message);
  resultados.eventos.push(`Error: ${e.message}`);
});

// Captura de teclas
document.addEventListener("keydown", (e) => {
  resultados.eventos.push(`Tecla: ${e.key}`);
});

// Captura de clicks
document.addEventListener("click", (e) => {
  resultados.eventos.push(`Click en X:${e.clientX}, Y:${e.clientY}`);
});

// Captura de scroll
window.addEventListener("scroll", () => {
  resultados.eventos.push("Scroll detectado");
});

// Captura de carga inicial
window.addEventListener("load", () => {
  resultados.eventos.push("Página cargada");
});

// Guardado automático al cerrar
window.addEventListener("beforeunload", () => {
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
