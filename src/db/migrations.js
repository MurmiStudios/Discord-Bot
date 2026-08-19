/**
 * Geordnete Liste von Migrationen.
 *
 * Der Fortschritt steckt in SQLites eigenem `user_version`-Pragma: Migration
 * mit id N wird ausgeführt, wenn user_version < N ist, danach wird
 * user_version auf N gesetzt. Beides passiert in einer Transaktion, damit ein
 * Abbruch mittendrin keinen halben Stand hinterlässt.
 *
 * Bestehende Migrationen NIE nachträglich ändern — immer eine neue anhängen.
 */
export const migrations = [
  {
    id: 1,
    name: 'grundschema',
    sql: `
      CREATE TABLE settings (
        key        TEXT PRIMARY KEY,
        value      TEXT    NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE image_templates (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id        TEXT    NOT NULL,
        name            TEXT    NOT NULL,
        kind            TEXT    NOT NULL CHECK (kind IN ('welcome','role','generic')),
        width           INTEGER NOT NULL DEFAULT 1000,
        height          INTEGER NOT NULL DEFAULT 400,
        background_file TEXT,
        config          TEXT    NOT NULL,
        created_at      INTEGER NOT NULL,
        updated_at      INTEGER NOT NULL,
        UNIQUE (guild_id, name)
      );

      CREATE TABLE role_rules (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id        TEXT    NOT NULL,
        trigger_role_id TEXT    NOT NULL,
        remove_role_ids TEXT    NOT NULL,
        enabled         INTEGER NOT NULL DEFAULT 1,
        note            TEXT,
        created_at      INTEGER NOT NULL,
        updated_at      INTEGER NOT NULL
      );
      CREATE INDEX idx_role_rules_trigger
        ON role_rules (guild_id, trigger_role_id, enabled);

      CREATE TABLE role_messages (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id    TEXT    NOT NULL,
        role_id     TEXT    NOT NULL,
        title       TEXT,
        body        TEXT    NOT NULL,
        template_id INTEGER REFERENCES image_templates(id) ON DELETE SET NULL,
        auto_send   INTEGER NOT NULL DEFAULT 0,
        enabled     INTEGER NOT NULL DEFAULT 1,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      );
      CREATE INDEX idx_role_messages_role ON role_messages (guild_id, role_id, enabled);

      CREATE TABLE member_roles (
        guild_id   TEXT    NOT NULL,
        user_id    TEXT    NOT NULL,
        role_ids   TEXT    NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (guild_id, user_id)
      );

      CREATE TABLE send_log (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id          TEXT    NOT NULL,
        ts                INTEGER NOT NULL,
        kind              TEXT    NOT NULL,
        actor_id          TEXT,
        target_user_id    TEXT,
        target_channel_id TEXT,
        template_id       INTEGER,
        status            TEXT    NOT NULL,
        error_code        INTEGER,
        detail            TEXT,
        payload_excerpt   TEXT
      );
      CREATE INDEX idx_send_log_ts ON send_log (guild_id, ts DESC);

      CREATE TABLE sessions (
        sid     TEXT PRIMARY KEY,
        expires INTEGER NOT NULL,
        data    TEXT    NOT NULL
      );
      CREATE INDEX idx_sessions_expires ON sessions (expires);
    `,
  },
];

/** Führt alle noch nicht angewandten Migrationen aus. Gibt die Anzahl zurück. */
export function runMigrations(db, log = null) {
  let version = db.pragma('user_version', { simple: true });
  let angewandt = 0;

  for (const m of migrations) {
    if (m.id <= version) continue;
    db.transaction(() => {
      db.exec(m.sql);
      // Pragma-Werte lassen sich nicht binden, daher direkt eingesetzt.
      // m.id stammt ausschliesslich aus dieser Datei, nie aus Eingaben.
      db.pragma(`user_version = ${m.id}`);
    })();
    log?.info({ migration: m.id, name: m.name }, 'Migration angewandt');
    version = m.id;
    angewandt += 1;
  }
  return angewandt;
}
