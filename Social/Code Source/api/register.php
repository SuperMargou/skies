<?php
require __DIR__ . '/config.php';

$input = json_decode(file_get_contents('php://input'), true) ?: ($_POST ?? []);
$handle = strtolower(trim((string)($input['handle'] ?? '')));
$password = (string)($input['password'] ?? '');

if (strlen($handle) < 3) {
    json_response(['error' => 'Handle trop court'], 400);
}

if (strlen($password) < 6) {
    json_response(['error' => 'Mot de passe trop court (6+ caracteres)'], 400);
}

// Reserve le pseudo si dispo
$pdo = db();
$stmt = $pdo->prepare('SELECT id FROM users WHERE handle = ?');
$stmt->execute([$handle]);
$existing = $stmt->fetch();
if ($existing) {
    json_response(['error' => 'Handle deja pris'], 409);
}

$token = bin2hex(random_bytes(32));
$hash = password_hash($password, PASSWORD_DEFAULT);
$stmt = $pdo->prepare('INSERT INTO users (handle, token, password_hash) VALUES (?, ?, ?)');
$stmt->execute([$handle, $token, $hash]);
$userId = (int)$pdo->lastInsertId();

json_response([
    'userId' => $userId,
    'handle' => $handle,
    'token' => $token,
    'avatarUrl' => null,
]);
