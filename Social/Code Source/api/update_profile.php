<?php
require __DIR__ . '/config.php';
$user = require_user();

$input = json_decode(file_get_contents('php://input'), true) ?: ($_POST ?? []);
$bio = trim((string)($input['bio'] ?? ''));
$avatarUrl = null;

$max = 300;
if (strlen($bio) > $max) {
    json_response(['error' => "Bio trop longue ({$max} max)"], 400);
}

// Upload avatar si fourni
if (!empty($_FILES['avatar']['tmp_name'])) {
    $tmp = $_FILES['avatar']['tmp_name'];
    $info = getimagesize($tmp);
    if (!$info || !in_array($info['mime'], ['image/png', 'image/jpeg', 'image/webp'])) {
        json_response(['error' => 'Type image invalide'], 400);
    }
    if ($_FILES['avatar']['size'] > 2 * 1024 * 1024) {
        json_response(['error' => 'Avatar trop lourd (2 Mo max)'], 400);
    }
    $ext = $info['mime'] === 'image/png' ? 'png' : ($info['mime'] === 'image/webp' ? 'webp' : 'jpg');
    $baseDir = realpath(__DIR__ . '/..');
    $fileName = 'uploads/avatars/' . uniqid('avatar_', true) . '.' . $ext;
    $dest = $baseDir . '/' . $fileName;
    if (!is_dir(dirname($dest))) {
        @mkdir(dirname($dest), 0775, true);
    }
    if (!move_uploaded_file($tmp, $dest)) {
        json_response(['error' => 'Upload avatar echoue'], 500);
    }
    $avatarUrl = '/' . ltrim($fileName, '/');
}

$fields = ['bio' => $bio];
$params = [$bio, $user['id']];
$sql = 'UPDATE users SET bio = ?';
if ($avatarUrl !== null) {
    $sql = 'UPDATE users SET bio = ?, avatar_url = ? WHERE id = ?';
    $params = [$bio, $avatarUrl, $user['id']];
} else {
    $sql = 'UPDATE users SET bio = ? WHERE id = ?';
}

$stmt = db()->prepare($sql);
$stmt->execute($params);

json_response([
    'handle' => $user['handle'],
    'bio' => $bio,
    'avatarUrl' => $avatarUrl,
]);
