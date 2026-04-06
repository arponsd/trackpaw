CREATE TABLE IF NOT EXISTS tp_migrations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    migration_name  TEXT NOT NULL UNIQUE,
    applied_at      TEXT NOT NULL
);
