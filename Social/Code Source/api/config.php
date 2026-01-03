<?php

// Connexion PDO. Ajuste les constantes si besoin.
const DB_HOST = 'urgenceskies.mysql.db';
const DB_NAME = 'urgenceskies';
const DB_USER = 'urgenceskies';
const DB_PASS = '14impJeliotte';
const DB_PORT = 3306;

function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }
    return $pdo;
}

function json_response($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function bearer_token(): ?string {
    // Certains hebergeurs placent le header Authorization dans des variables differentes
    $sources = [
        $_SERVER['HTTP_AUTHORIZATION'] ?? null,
        $_SERVER['Authorization'] ?? null,
        $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? null,
    ];
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    if (isset($headers['Authorization'])) {
        $sources[] = $headers['Authorization'];
    }
    foreach ($sources as $auth) {
        if ($auth && stripos($auth, 'Bearer ') === 0) {
            return substr($auth, 7);
        }
    }
    return null;
}

function require_user(): array {
    $token = bearer_token() ?? ($_POST['token'] ?? $_GET['token'] ?? null);
    if (!$token) {
        json_response(['error' => 'Unauthorized'], 401);
    }
    $stmt = db()->prepare('SELECT id, handle FROM users WHERE token = ?');
    $stmt->execute([$token]);
    $user = $stmt->fetch();
    if (!$user) {
        json_response(['error' => 'Invalid token'], 401);
    }
    return $user;
}

function ensure_tables(): void {
    // Minimal auto-provisioning if tables manquantes.
    $sql = [
        "CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            handle VARCHAR(50) NOT NULL UNIQUE,
            token CHAR(64) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NULL,
            bio TEXT NULL,
            avatar_url VARCHAR(255) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        "CREATE TABLE IF NOT EXISTS posts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            text TEXT,
            image_url VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        "CREATE TABLE IF NOT EXISTS likes (
            user_id INT NOT NULL,
            post_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, post_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        "CREATE TABLE IF NOT EXISTS comments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            post_id INT NOT NULL,
            user_id INT NOT NULL,
            text TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        "CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC)",
        "CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at DESC)"
    ];

    $pdo = db();
    foreach ($sql as $statement) {
        // MySQL ne supporte pas IF NOT EXISTS sur les index de la meme facon, donc on ignore silencieusement si erreur.
        try {
            $pdo->exec($statement);
        } catch (Throwable $e) {
            // ignore
        }
    }

    // Tentative d'ajout de colonne si elle n'existe pas deja (pour migrations douces)
    $migrations = [
        "ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL AFTER token",
        "ALTER TABLE users ADD COLUMN bio TEXT NULL AFTER password_hash",
        "ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255) NULL AFTER bio",
        "CREATE TABLE IF NOT EXISTS messages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            sender_id INT NOT NULL,
            receiver_id INT NOT NULL,
            text TEXT NOT NULL,
            seen TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_messages_pair (sender_id, receiver_id),
            INDEX idx_messages_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        "CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages(sender_id, receiver_id)",
        "CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)"
    ];
    foreach ($migrations as $sql) {
        try {
            $pdo->exec($sql);
        } catch (Throwable $e) {
            // ignore si deja present
        }
    }
}

function ensure_upload_dir(): void {
    $dir = realpath(__DIR__ . '/..') . '/uploads';
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
}

ensure_upload_dir();
ensure_tables();
