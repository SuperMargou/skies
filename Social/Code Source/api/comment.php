<?php
require __DIR__ . '/config.php';
$user = require_user();

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$postId = (int)($input['postId'] ?? 0);
$text = trim($input['text'] ?? '');

if ($postId <= 0) json_response(['error' => 'Post id manquant'], 400);
if (strlen($text) === 0) json_response(['error' => 'Texte manquant'], 400);
if (strlen($text) > 280) json_response(['error' => 'Texte trop long (280)'], 400);

$pdo = db();
$stmt = $pdo->prepare('SELECT 1 FROM posts WHERE id = ?');
$stmt->execute([$postId]);
if (!$stmt->fetch()) json_response(['error' => 'Post introuvable'], 404);

$stmt = $pdo->prepare('INSERT INTO comments (post_id, user_id, text) VALUES (?, ?, ?)');
$stmt->execute([$postId, $user['id'], $text]);
$commentId = (int)$pdo->lastInsertId();

json_response([
    'id' => $commentId,
    'postId' => $postId,
    'text' => $text,
    'authorHandle' => $user['handle'],
    'createdAt' => date('c'),
]);
