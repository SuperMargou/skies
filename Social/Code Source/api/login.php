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

$pdo = db();
$stmt = $pdo->prepare('SELECT id, handle, password_hash, token, avatar_url FROM users WHERE handle = ?');
$stmt->execute([$handle]);
$user = $stmt->fetch();

$token = bin2hex(random_bytes(32));

if (!$user) {
    json_response(['error' => 'Compte introuvable. Cree un compte d\'abord.'], 404);
}

// Utilisateur existant : on verifie le mot de passe ou on l'initialise s'il n'existe pas encore.
if (empty($user['password_hash'])) {
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $update = $pdo->prepare('UPDATE users SET password_hash = ?, token = ? WHERE id = ?');
    $update->execute([$hash, $token, $user['id']]);
    json_response(['userId' => (int)$user['id'], 'handle' => $user['handle'], 'token' => $token, 'avatarUrl' => $user['avatar_url'] ?? null]);
}

if (!password_verify($password, $user['password_hash'])) {
    json_response(['error' => 'Mot de passe incorrect'], 401);
}

$update = $pdo->prepare('UPDATE users SET token = ? WHERE id = ?');
$update->execute([$token, $user['id']]);

json_response(['userId' => (int)$user['id'], 'handle' => $user['handle'], 'token' => $token, 'avatarUrl' => $user['avatar_url'] ?? null]);
