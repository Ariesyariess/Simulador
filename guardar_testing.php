<?php
header('Content-Type: application/json; charset=utf-8');

$data = json_decode(file_get_contents("php://input"), true);
$file = __DIR__ . '/reports/testing_resultados.json';

$current = [];
if (file_exists($file)) {
    $contenido = file_get_contents($file);
    if ($contenido !== false && trim($contenido) !== '') {
        $datosExistentes = json_decode($contenido, true);
        if (is_array($datosExistentes)) $current = $datosExistentes;
    }
}

$current[] = $data;

file_put_contents(
    $file,
    json_encode($current, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
    LOCK_EX
);

echo json_encode(["ok" => true, "mensaje" => "Testing guardado en JSON"]);
?>
