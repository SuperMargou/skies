<?php
require_once __DIR__ . '/lib/bootstrap.php'; // Assumes a bootstrap that sets $db and auth

header('Content-Type: application/json');

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $token = $_GET['token'] ?? ($input['token'] ?? '');
    $handle = trim($input['handle'] ?? '');

    if (!$token || !$handle) {
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

    // find target user
    $stmt = $db->prepare('SELECT id FROM users WHERE handle = ?');
    $stmt->execute([$handle]);
    $target = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$target) {
        http_response_code(404);
        echo json_encode(['error' => 'Utilisateur introuvable']);
        exit;
    }

    $targetId = $target['id'];
    if ($targetId == $user['id']) {
        echo json_encode(['following' => false, 'followersCount' => followers_count($db, $targetId)]);
        exit;
    }

    // check if already following
    $stmt = $db->prepare('SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?');
    $stmt->execute([$user['id'], $targetId]);
    $isFollowing = (bool)$stmt->fetchColumn();

    if ($isFollowing) {
        $del = $db->prepare('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?');
        $del->execute([$user['id'], $targetId]);
        $following = false;
    } else {
        $ins = $db->prepare('INSERT INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, NOW())');
        $ins->execute([$user['id'], $targetId]);
        $following = true;
    }

    $count = followers_count($db, $targetId);
    echo json_encode(['following' => $following, 'followersCount' => $count]);
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

function followers_count($db, $userId) {
    $stmt = $db->prepare('SELECT COUNT(*) FROM follows WHERE followee_id = ?');
    $stmt->execute([$userId]);
    return (int)$stmt->fetchColumn();
}
