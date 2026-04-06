CREATE TABLE IF NOT EXISTS tp_users (
    user_id         TEXT PRIMARY KEY,
    anonymous_ids   TEXT DEFAULT '[]',
    traits          TEXT DEFAULT '{}',
    first_seen      TEXT NOT NULL,
    last_seen       TEXT NOT NULL,
    total_events    INTEGER DEFAULT 0,
    total_sessions  INTEGER DEFAULT 0,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_first_seen ON tp_users (first_seen);
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON tp_users (last_seen);
