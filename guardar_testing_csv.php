<?php
header('Content-Type: application/json; charset=utf-8');

$data = json_decode(file_get_contents("php://input"), true);
$file = __DIR__ . '/reports/testing_resultados.csv';

$nuevoArchivo = !file_exists($file);

$fp = fopen($file, 'a');
if ($nuevoArchivo) {
    fputcsv($fp, ['Fecha','FPS','Errores','Eventos']);
}

fputcsv($fp, [
    $data['fecha'] ?? date('Y-m-d H:i:s'),
    $data['fpsPromedio'] ?? '',
    isset($data['errores']) ? implode(" | ", $data['errores']) : '',
    isset($data['eventos']) ? implode(" | ", $data['eventos']) : ''
]);

fclose($fp);

echo json_encode(["ok" => true, "mensaje" => "Testing guardado en CSV"]);
?>
