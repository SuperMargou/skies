<?php
require __DIR__ . '/config.php';
$user = require_user();

$text = trim($_POST['text'] ?? '');
if (strlen($text) === 0 && empty($_FILES['image'])) {
    json_response(['error' => 'Texte ou image requis'], 400);
}
if (strlen($text) > 400) {
    json_response(['error' => 'Texte trop long (400 max)'], 400);
}

$imageUrl = null;
if (!empty($_FILES['image']['tmp_name'])) {
    $tmp = $_FILES['image']['tmp_name'];
    $info = getimagesize($tmp);
    if (!$info || !in_array($info['mime'], ['image/png', 'image/jpeg', 'image/webp'])) {
        json_response(['error' => 'Type image invalide'], 400);
    }
    if ($_FILES['image']['size'] > 2 * 1024 * 1024) {
        json_response(['error' => 'Image trop lourde (2 Mo max)'], 400);
    }
    $ext = $info['mime'] === 'image/png' ? 'png' : ($info['mime'] === 'image/webp' ? 'webp' : 'jpg');
    $baseDir = realpath(__DIR__ . '/..');
    if (!$baseDir) {
        json_response(['error' => 'Chemin base introuvable'], 500);
    }
    $fileName = 'uploads/' . uniqid('post_', true) . '.' . $ext;
    $dest = $baseDir . '/' . $fileName;
    if (!is_dir(dirname($dest))) {
        @mkdir(dirname($dest), 0775, true);
    }
    if (!move_uploaded_file($tmp, $dest)) {
        json_response(['error' => 'Upload echoue'], 500);
    }
    $imageUrl = '/' . ltrim($fileName, '/');
}

$pdo = db();
$stmt = $pdo->prepare('INSERT INTO posts (user_id, text, image_url) VALUES (?, ?, ?)');
$stmt->execute([$user['id'], $text, $imageUrl]);
$postId = (int)$pdo->lastInsertId();

json_response([
    'id' => $postId,
    'text' => $text,
    'imageUrl' => $imageUrl,
    'authorHandle' => $user['handle'],
    'createdAt' => date('c'),
]);
