<?php
require __DIR__ . '/config.php';
$user = require_user();
$uid = (int)$user['id'];

$input = json_decode(file_get_contents('php://input'), true) ?: ($_POST ?? []);
$handle = strtolower(trim((string)($input['handle'] ?? '')));
$handle = ltrim($handle, '@'); // autoriser les handles passes avec @
$text = trim((string)($input['text'] ?? ''));

if (!$handle || !$text) {
    json_response(['error' => 'Handle et texte requis'], 400);
}
if (strlen($text) > 1000) {
    json_response(['error' => 'Message trop long (1000 max)'], 400);
}

$pdo = db();
$stmt = $pdo->prepare('SELECT id FROM users WHERE handle = ?');
$stmt->execute([$handle]);
$target = $stmt->fetch();
if (!$target) {
    json_response(['error' => 'Destinataire introuvable'], 404);
}
$targetId = (int)$target['id'];

$insert = $pdo->prepare('INSERT INTO messages (sender_id, receiver_id, text, created_at) VALUES (?, ?, ?, NOW())');
$insert->execute([$uid, $targetId, $text]);
$messageId = (int)$pdo->lastInsertId();
$createdAt = $pdo->prepare('SELECT created_at FROM messages WHERE id = ?');
$createdAt->execute([$messageId]);
$created = $createdAt->fetchColumn();

json_response([
    'ok' => true,
    'createdAt' => $created ?: date('c'),
    'message' => [
        'fromMe' => true,
        'text' => $text,
        'createdAt' => $created ?: date('c'),
    ],
]);
