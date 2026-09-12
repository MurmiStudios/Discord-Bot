CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('dm', 'channel')),
  content TEXT NOT NULL DEFAULT '',
  embed_json TEXT,
  image_template_id INTEGER REFERENCES image_templates(id) ON DELETE SET NULL,
  action_bar_id INTEGER REFERENCES action_bars(id) ON DELETE SET NULL,
  target_json TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS welcome_message (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  content TEXT NOT NULL DEFAULT '',
  embed_json TEXT,
  image_template_id INTEGER REFERENCES image_templates(id) ON DELETE SET NULL,
  action_bar_id INTEGER REFERENCES action_bars(id) ON DELETE SET NULL,
  active INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS role_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL DEFAULT '',
  embed_json TEXT,
  image_template_id INTEGER REFERENCES image_templates(id) ON DELETE SET NULL,
  action_bar_id INTEGER REFERENCES action_bars(id) ON DELETE SET NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS role_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger_role_id TEXT NOT NULL,
  remove_role_ids_json TEXT NOT NULL DEFAULT '[]',
  note TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS action_bars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  buttons_json TEXT NOT NULL DEFAULT '[]',
  once_per_member INTEGER NOT NULL DEFAULT 0,
  ephemeral_reply INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS image_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  width INTEGER NOT NULL DEFAULT 1200,
  height INTEGER NOT NULL DEFAULT 500,
  bg_type TEXT NOT NULL DEFAULT 'color' CHECK (bg_type IN ('color', 'image')),
  bg_color TEXT NOT NULL DEFAULT '#5865f2',
  bg_image_path TEXT,
  bg_dim REAL NOT NULL DEFAULT 0,
  avatar_json TEXT NOT NULL DEFAULT '{"enabled":true,"shape":"round","x":80,"y":330,"size":90,"border":0}',
  lines_json TEXT NOT NULL DEFAULT '[]',
  align TEXT NOT NULL DEFAULT 'left' CHECK (align IN ('left', 'center', 'right')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS button_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action_bar_id INTEGER NOT NULL,
  button_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  clicked_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (action_bar_id, button_id, user_id)
);

CREATE TABLE IF NOT EXISTS feedback_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action_bar_id INTEGER,
  button_id TEXT,
  button_label TEXT NOT NULL DEFAULT '',
  user_id TEXT NOT NULL,
  user_tag TEXT NOT NULL,
  answers_json TEXT NOT NULL DEFAULT '[]',
  submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('nachricht', 'rolle', 'anmeldung', 'fehler')),
  actor_id TEXT,
  actor_tag TEXT,
  summary TEXT NOT NULL,
  detail_json TEXT,
  success INTEGER NOT NULL DEFAULT 1,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_kind ON messages(kind);
CREATE INDEX IF NOT EXISTS idx_feedback_action_bar ON feedback_responses(action_bar_id);

INSERT OR IGNORE INTO welcome_message (id) VALUES (1);

CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);
