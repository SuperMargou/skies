<?php
require_once __DIR__ . '/lib/bootstrap.php'; // Assumes $db and auth helpers
header('Content-Type: application/json');

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $token = $_GET['token'] ?? ($input['token'] ?? '');
    $postId = intval($input['postId'] ?? 0);

    if (!$token || !$postId) {
        http_response_code(400);
        echo json_encode(['error' => 'Parametres manquants']);
        exit;
    }

    $user = auth_user_by_token($token);
    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Non autorise']);
        exit;
    }

    // prevent double count per user/post
    $stmt = $db->prepare('SELECT 1 FROM post_views WHERE post_id = ? AND user_id = ?');
    $stmt->execute([$postId, $user['id']]);
    if (!$stmt->fetchColumn()) {
        $ins = $db->prepare('INSERT INTO post_views (post_id, user_id, created_at) VALUES (?, ?, NOW())');
        $ins->execute([$postId, $user['id']]);
    }

    // return updated count
    $countStmt = $db->prepare('SELECT COUNT(*) FROM post_views WHERE post_id = ?');
    $countStmt->execute([$postId]);
    $count = (int)$countStmt->fetchColumn();

    $upd = $db->prepare('UPDATE posts SET view_count = ? WHERE id = ?');
    $upd->execute([$count, $postId]);

    echo json_encode(['viewCount' => $count]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Erreur serveur']);
}

function auth_user_by_token($token) {
    global $db;
    $stmt = $db->prepare('SELECT id, handle FROM users WHERE token = ?');
    $stmt->execute([$token]);
    return $stmt->fetch(PDO::FETCH_ASSOC);
}
