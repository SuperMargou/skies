<?php
require __DIR__ . '/config.php';
$user = require_user();
$uid = (int)$user['id'];

$q = isset($_GET['q']) ? trim((string)$_GET['q']) : '';
$q = $q ?: (isset($_POST['q']) ? trim((string)$_POST['q']) : '');

if ($q === '') {
    json_response(['users' => []]);
}

// Normalise: pas de @ en base
$q = ltrim($q, '@');
// On limite la taille pour éviter les scans trop larges
if (strlen($q) > 50) {
    $q = substr($q, 0, 50);
}

$pdo = db();
$stmt = $pdo->prepare("
    SELECT handle, avatar_url
    FROM users
    WHERE handle LIKE ? AND id != ?
    ORDER BY handle ASC
    LIMIT 15
");
$stmt->execute([$q . '%', $uid]);
$users = [];
while ($row = $stmt->fetch()) {
    $users[] = [
        'handle' => $row['handle'],
        'avatarUrl' => $row['avatar_url'] ?? null,
    ];
}

json_response(['users' => $users]);
