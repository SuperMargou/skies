<?php
require __DIR__ . '/config.php';

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$handle = strtolower(trim((string)($_GET['handle'] ?? $input['handle'] ?? '')));

$viewer = null;
$token = bearer_token() ?? ($input['token'] ?? null);
if ($token) {
    $stmt = db()->prepare('SELECT id, handle FROM users WHERE token = ?');
    $stmt->execute([$token]);
    $viewer = $stmt->fetch();
}

if (!$handle && $viewer) {
    $handle = strtolower($viewer['handle']);
}

if (!$handle) {
    json_response(['error' => 'Handle requis'], 400);
}

$stmt = db()->prepare('SELECT id, handle, bio, created_at, avatar_url FROM users WHERE handle = ?');
$stmt->execute([$handle]);
$user = $stmt->fetch();
if (!$user) {
    json_response(['error' => 'Utilisateur introuvable'], 404);
}

$isSelf = $viewer && strtolower($viewer['handle']) === strtolower($user['handle']);

json_response([
    'handle' => $user['handle'],
    'bio' => $user['bio'] ?? '',
    'createdAt' => $user['created_at'],
    'avatarUrl' => $user['avatar_url'] ?? null,
    'isSelf' => $isSelf,
]);
