<?php
require __DIR__ . '/config.php';

$postId = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if ($postId <= 0) json_response(['error' => 'Post id manquant'], 400);

$user = null;
$token = bearer_token();
if ($token) {
    $stmt = db()->prepare('SELECT id FROM users WHERE token = ?');
    $stmt->execute([$token]);
    $user = $stmt->fetch();
}
$viewerId = $user['id'] ?? 0;

$pdo = db();
$stmt = $pdo->prepare("
    SELECT 
        p.id,
        p.text,
        p.image_url AS imageUrl,
        p.created_at AS createdAt,
        u.handle AS authorHandle,
        u.id AS authorId,
        (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS likeCount,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS commentCount,
        EXISTS(SELECT 1 FROM likes l2 WHERE l2.post_id = p.id AND l2.user_id = {$viewerId}) AS liked
    FROM posts p
    JOIN users u ON u.id = p.user_id
    WHERE p.id = ?
    LIMIT 1
");
$stmt->execute([$postId]);
$post = $stmt->fetch();
if (!$post) json_response(['error' => 'Post introuvable'], 404);

$cStmt = $pdo->prepare("
    SELECT c.id, c.text, c.created_at AS createdAt, u.handle AS authorHandle
    FROM comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.post_id = ?
    ORDER BY c.created_at DESC
");
$cStmt->execute([$postId]);
$comments = $cStmt->fetchAll();

json_response(['post' => $post, 'comments' => $comments]);
