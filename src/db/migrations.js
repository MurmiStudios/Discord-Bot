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
  {
    id: 2,
    name: 'aktionsleisten',
    sql: `
      -- Eine Aktionsleiste bündelt Buttons, die sich an beliebige Nachrichten
      -- hängen lassen. Discord erlaubt 5 Buttons je Reihe und 5 Reihen, also
      -- höchstens 25 Buttons je Nachricht.
      CREATE TABLE button_sets (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id   TEXT    NOT NULL,
        name       TEXT    NOT NULL,
        note       TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE (guild_id, name)
      );

      CREATE TABLE buttons (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        set_id           INTEGER NOT NULL REFERENCES button_sets(id) ON DELETE CASCADE,
        position         INTEGER NOT NULL DEFAULT 0,
        label            TEXT    NOT NULL,
        style            TEXT    NOT NULL DEFAULT 'primary'
                           CHECK (style IN ('primary','secondary','success','danger')),
        emoji            TEXT,
        -- Geordnete Liste von Aktionen. Ein Button kann mehrere ausführen.
        actions          TEXT    NOT NULL DEFAULT '[]',
        -- Leere Liste bedeutet: alle dürfen klicken.
        allowed_role_ids TEXT    NOT NULL DEFAULT '[]',
        once_per_user    INTEGER NOT NULL DEFAULT 0,
        reply_text       TEXT    NOT NULL DEFAULT '',
        enabled          INTEGER NOT NULL DEFAULT 1,
        created_at       INTEGER NOT NULL,
        updated_at       INTEGER NOT NULL
      );
      CREATE INDEX idx_buttons_set ON buttons (set_id, position);

      -- Für "nur einmal je Mitglied". Der Primärschlüssel verhindert
      -- Doppeleinträge auch bei zwei gleichzeitigen Klicks.
      CREATE TABLE button_uses (
        button_id INTEGER NOT NULL REFERENCES buttons(id) ON DELETE CASCADE,
        user_id   TEXT    NOT NULL,
        used_at   INTEGER NOT NULL,
        PRIMARY KEY (button_id, user_id)
      );

      -- Anhängen an bestehende Nachrichtenarten.
      ALTER TABLE role_messages ADD COLUMN button_set_id INTEGER
        REFERENCES button_sets(id) ON DELETE SET NULL;
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
