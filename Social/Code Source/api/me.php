<?php
require __DIR__ . '/config.php';
$user = require_user();
$stmt = db()->prepare('SELECT avatar_url FROM users WHERE id = ?');
$stmt->execute([$user['id']]);
$row = $stmt->fetch();
$avatarUrl = $row['avatar_url'] ?? null;
json_response([
    'userId' => (int)$user['id'],
    'handle' => $user['handle'],
    'avatarUrl' => $avatarUrl,
]);
