/**
 * Rollenregeln: "Wer Rolle B bekommt, verliert Rolle A."
 * `remove_role_ids` ist eine JSON-Liste, damit eine Regel mehrere Rollen auf
 * einmal entfernen kann.
 */
function zuRegel(row) {
  if (!row) return null;
  let entfernen = [];
  try {
    const parsed = JSON.parse(row.remove_role_ids);
    if (Array.isArray(parsed)) entfernen = parsed.filter((x) => typeof x === 'string');
  } catch {
    entfernen = [];
  }
  return {
    id: row.id,
    guildId: row.guild_id,
    triggerRoleId: row.trigger_role_id,
    removeRoleIds: entfernen,
    enabled: row.enabled === 1,
    note: row.note ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createRoleRulesRepo(db) {
  const stmts = {
    all: db.prepare('SELECT * FROM role_rules WHERE guild_id = ? ORDER BY id'),
    enabled: db.prepare('SELECT * FROM role_rules WHERE guild_id = ? AND enabled = 1 ORDER BY id'),
    byId: db.prepare('SELECT * FROM role_rules WHERE guild_id = ? AND id = ?'),
    insert: db.prepare(`
      INSERT INTO role_rules
        (guild_id, trigger_role_id, remove_role_ids, enabled, note, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
    update: db.prepare(`
      UPDATE role_rules
         SET trigger_role_id = ?, remove_role_ids = ?, enabled = ?, note = ?, updated_at = ?
       WHERE guild_id = ? AND id = ?
    `),
    del: db.prepare('DELETE FROM role_rules WHERE guild_id = ? AND id = ?'),
    toggle: db.prepare('UPDATE role_rules SET enabled = ?, updated_at = ? WHERE guild_id = ? AND id = ?'),
  };

  return {
    all: (guildId) => stmts.all.all(guildId).map(zuRegel),
    allEnabled: (guildId) => stmts.enabled.all(guildId).map(zuRegel),
    byId: (guildId, id) => zuRegel(stmts.byId.get(guildId, id)),

    create(guildId, { triggerRoleId, removeRoleIds, enabled = true, note = '' }) {
      const now = Date.now();
      const info = stmts.insert.run(
        guildId,
        triggerRoleId,
        JSON.stringify([...new Set(removeRoleIds)]),
        enabled ? 1 : 0,
        note,
        now,
        now,
      );
      return this.byId(guildId, info.lastInsertRowid);
    },

    update(guildId, id, { triggerRoleId, removeRoleIds, enabled, note }) {
      stmts.update.run(
        triggerRoleId,
        JSON.stringify([...new Set(removeRoleIds)]),
        enabled ? 1 : 0,
        note ?? '',
        Date.now(),
        guildId,
        id,
      );
      return this.byId(guildId, id);
    },

    setEnabled(guildId, id, enabled) {
      stmts.toggle.run(enabled ? 1 : 0, Date.now(), guildId, id);
    },

    delete(guildId, id) {
      stmts.del.run(guildId, id);
    },
  };
}
