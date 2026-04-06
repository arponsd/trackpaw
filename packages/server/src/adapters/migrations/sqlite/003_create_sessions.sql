CREATE TABLE IF NOT EXISTS tp_sessions (
    session_id      TEXT PRIMARY KEY,
    user_id         TEXT,
    anonymous_id    TEXT NOT NULL,
    started_at      TEXT NOT NULL,
    ended_at        TEXT,
    duration_ms     INTEGER DEFAULT 0,
    event_count     INTEGER DEFAULT 0,
    entry_page      TEXT,
    exit_page       TEXT,
    referrer        TEXT,
    device_type     TEXT,
    browser         TEXT,
    os              TEXT,
    country         TEXT,
    is_bounce       INTEGER DEFAULT 0,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON tp_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_anonymous_id ON tp_sessions (anonymous_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON tp_sessions (started_at);
