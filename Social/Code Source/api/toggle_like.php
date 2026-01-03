<?php
require __DIR__ . '/config.php';
$user = require_user();

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$postId = (int)($input['postId'] ?? 0);
if ($postId <= 0) json_response(['error' => 'Post id manquant'], 400);

$pdo = db();
$pdo->beginTransaction();

$stmt = $pdo->prepare('SELECT 1 FROM posts WHERE id = ? FOR UPDATE');
$stmt->execute([$postId]);
if (!$stmt->fetch()) {
    $pdo->rollBack();
    json_response(['error' => 'Post inconnu'], 404);
}

$stmt = $pdo->prepare('SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?');
$stmt->execute([$postId, $user['id']]);
$liked = (bool)$stmt->fetch();

if ($liked) {
    $pdo->prepare('DELETE FROM likes WHERE post_id = ? AND user_id = ?')->execute([$postId, $user['id']]);
} else {
    $pdo->prepare('INSERT INTO likes (post_id, user_id) VALUES (?, ?)')->execute([$postId, $user['id']]);
}

$stmt = $pdo->prepare('SELECT COUNT(*) AS cnt FROM likes WHERE post_id = ?');
$stmt->execute([$postId]);
$count = (int)($stmt->fetch()['cnt'] ?? 0);

$pdo->commit();

json_response(['liked' => !$liked, 'likeCount' => $count]);
