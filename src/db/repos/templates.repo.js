/** Bildvorlagen. `config` hält das Layout als JSON (siehe images/templateSchema.js). */
function zuVorlage(row) {
  if (!row) return null;
  let cfg = {};
  try {
    cfg = JSON.parse(row.config);
  } catch {
    cfg = {};
  }
  return {
    id: row.id,
    guildId: row.guild_id,
    name: row.name,
    kind: row.kind,
    width: row.width,
    height: row.height,
    backgroundFile: row.background_file,
    config: cfg,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createTemplatesRepo(db) {
  const stmts = {
    all: db.prepare('SELECT * FROM image_templates WHERE guild_id = ? ORDER BY kind, name'),
    byKind: db.prepare('SELECT * FROM image_templates WHERE guild_id = ? AND kind = ? ORDER BY name'),
    byId: db.prepare('SELECT * FROM image_templates WHERE guild_id = ? AND id = ?'),
    insert: db.prepare(`
      INSERT INTO image_templates
        (guild_id, name, kind, width, height, background_file, config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    update: db.prepare(`
      UPDATE image_templates
         SET name = ?, kind = ?, width = ?, height = ?, background_file = ?, config = ?, updated_at = ?
       WHERE guild_id = ? AND id = ?
    `),
    setBackground: db.prepare(
      'UPDATE image_templates SET background_file = ?, updated_at = ? WHERE guild_id = ? AND id = ?',
    ),
    del: db.prepare('DELETE FROM image_templates WHERE guild_id = ? AND id = ?'),
  };

  return {
    all: (guildId) => stmts.all.all(guildId).map(zuVorlage),
    byKind: (guildId, kind) => stmts.byKind.all(guildId, kind).map(zuVorlage),
    byId: (guildId, id) => zuVorlage(stmts.byId.get(guildId, id)),

    create(guildId, { name, kind, width, height, backgroundFile = null, config }) {
      const now = Date.now();
      const info = stmts.insert.run(
        guildId, name, kind, width, height, backgroundFile, JSON.stringify(config), now, now,
      );
      return this.byId(guildId, info.lastInsertRowid);
    },

    update(guildId, id, { name, kind, width, height, backgroundFile, config }) {
      stmts.update.run(
        name, kind, width, height, backgroundFile, JSON.stringify(config), Date.now(), guildId, id,
      );
      return this.byId(guildId, id);
    },

    setBackground(guildId, id, datei) {
      stmts.setBackground.run(datei, Date.now(), guildId, id);
    },

    delete(guildId, id) {
      stmts.del.run(guildId, id);
    },
  };
}
