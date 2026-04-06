CREATE TABLE IF NOT EXISTS tp_events (
    id              TEXT PRIMARY KEY,
    event_name      TEXT NOT NULL,
    user_id         TEXT,
    anonymous_id    TEXT NOT NULL,
    session_id      TEXT NOT NULL,
    properties      TEXT DEFAULT '{}',
    timestamp       TEXT NOT NULL,
    received_at     TEXT NOT NULL,
    ip_address      TEXT,
    user_agent      TEXT,
    page_url        TEXT,
    page_title      TEXT,
    referrer        TEXT,
    device_type     TEXT,
    browser         TEXT,
    os              TEXT,
    country         TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_event_name ON tp_events (event_name);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON tp_events (user_id);
CREATE INDEX IF NOT EXISTS idx_events_anonymous_id ON tp_events (anonymous_id);
CREATE INDEX IF NOT EXISTS idx_events_session_id ON tp_events (session_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON tp_events (timestamp);
CREATE INDEX IF NOT EXISTS idx_events_name_timestamp ON tp_events (event_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_user_timestamp ON tp_events (user_id, timestamp);
