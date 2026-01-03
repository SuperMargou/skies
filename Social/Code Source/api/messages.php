<?php
require __DIR__ . '/config.php';
$user = require_user();
$uid = (int)$user['id'];
$pdo = db();

$handle = isset($_GET['handle']) ? strtolower(trim((string)$_GET['handle'])) : '';
$handle = $handle ?: (isset($_POST['handle']) ? strtolower(trim((string)$_POST['handle'])) : '');
$handle = ltrim($handle, '@'); // autoriser les handles passes avec @

if ($handle) {
    // Conversation avec un handle précis
    $stmt = $pdo->prepare('SELECT id, handle, avatar_url FROM users WHERE handle = ?');
    $stmt->execute([$handle]);
    $other = $stmt->fetch();
    if (!$other) {
        json_response(['error' => 'Utilisateur introuvable'], 404);
    }
    $otherId = (int)$other['id'];

    $msgStmt = $pdo->prepare('
        SELECT sender_id, receiver_id, text, created_at
        FROM messages
        WHERE (sender_id = :uid AND receiver_id = :other)
           OR (sender_id = :other AND receiver_id = :uid)
        ORDER BY created_at ASC
    ');
    $msgStmt->execute(['uid' => $uid, 'other' => $otherId]);
    $messages = [];
    while ($row = $msgStmt->fetch()) {
        $messages[] = [
          'fromMe' => (int)$row['sender_id'] === $uid,
          'text' => $row['text'],
          'createdAt' => $row['created_at'],
        ];
    }

    // Marquer comme lus les messages reçus
    $pdo->prepare('UPDATE messages SET seen = 1 WHERE receiver_id = ? AND sender_id = ? AND seen = 0')
        ->execute([$uid, $otherId]);

    json_response([
        'handle' => $other['handle'],
        'avatarUrl' => $other['avatar_url'] ?? null,
        'messages' => $messages,
    ]);
}

// Liste des conversations
$sql = "
SELECT
    u.id AS otherId,
    u.handle AS otherHandle,
    u.avatar_url AS avatarUrl,
    MAX(m.created_at) AS lastAt,
    SUBSTRING_INDEX(GROUP_CONCAT(m.text ORDER BY m.created_at DESC SEPARATOR '||'), '||', 1) AS lastText,
    SUM(CASE WHEN m.receiver_id = :uid AND m.seen = 0 THEN 1 ELSE 0 END) AS unread
FROM messages m
JOIN users u ON u.id = CASE WHEN m.sender_id = :uid THEN m.receiver_id ELSE m.sender_id END
WHERE m.sender_id = :uid OR m.receiver_id = :uid
GROUP BY otherId, otherHandle, avatarUrl
ORDER BY lastAt DESC
LIMIT 100
";

$stmt = $pdo->prepare($sql);
$stmt->execute(['uid' => $uid]);
$threads = [];
$totalUnread = 0;
while ($row = $stmt->fetch()) {
    $unread = (int)$row['unread'] > 0;
    if ($unread) $totalUnread++;
    $threads[] = [
        'handle' => $row['otherHandle'],
        'avatarUrl' => $row['avatarUrl'] ?? null,
        'last' => $row['lastText'],
        'updatedAt' => $row['lastAt'],
        'unread' => $unread,
    ];
}

json_response([
    'threads' => $threads,
    'unreadCount' => $totalUnread,
]);
