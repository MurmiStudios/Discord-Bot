/**
 * Schlüssel/Wert-Einstellungen. Werte werden als JSON abgelegt, damit auch
 * Zahlen, Booleans und kleine Objekte verlustfrei zurückkommen.
 */
export function createSettingsRepo(db) {
  const stmts = {
    get: db.prepare('SELECT value FROM settings WHERE key = ?'),
    all: db.prepare('SELECT key, value FROM settings'),
    set: db.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `),
    del: db.prepare('DELETE FROM settings WHERE key = ?'),
  };

  return {
    get(key, fallback = null) {
      const row = stmts.get.get(key);
      if (!row) return fallback;
      try {
        return JSON.parse(row.value);
      } catch {
        return fallback;
      }
    },

    set(key, value) {
      stmts.set.run(key, JSON.stringify(value ?? null), Date.now());
    },

    /** Mehrere Werte in einer Transaktion — für Formulare mit vielen Feldern. */
    setMany(obj) {
      db.transaction(() => {
        for (const [k, v] of Object.entries(obj)) this.set(k, v);
      }).call(this);
    },

    all() {
      const out = {};
      for (const row of stmts.all.all()) {
        try {
          out[row.key] = JSON.parse(row.value);
        } catch {
          out[row.key] = null;
        }
      }
      return out;
    },

    delete(key) {
      stmts.del.run(key);
    },
  };
}
