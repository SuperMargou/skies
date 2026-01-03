<?php
// Minimal bootstrap placeholder; integrate with your real DB/bootstrap.
$dsn = getenv('DB_DSN') ?: 'mysql:host=localhost;dbname=skies;charset=utf8mb4';
$user = getenv('DB_USER') ?: 'root';
$pass = getenv('DB_PASS') ?: '';

try {
    $db = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'DB init error']);
    exit;
}
