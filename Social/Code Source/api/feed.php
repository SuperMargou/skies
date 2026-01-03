<?php
require __DIR__ . '/config.php';

$user = null;
$token = bearer_token();
if ($token) {
    $stmt = db()->prepare('SELECT id FROM users WHERE token = ?');
    $stmt->execute([$token]);
    $user = $stmt->fetch();
}
$viewerId = $user['id'] ?? 0;

$pdo = db();
$stmt = $pdo->query("
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
    ORDER BY p.created_at DESC
    LIMIT 100
");
$rows = $stmt->fetchAll();
json_response(['posts' => $rows]);
