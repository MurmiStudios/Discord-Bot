/**
 * Rollen-Nachrichten: Text (+ optionale Bildvorlage), der einem Mitglied als
 * DM geschickt wird — entweder von Hand über das Panel oder automatisch,
 * sobald es die Rolle erhält (`autoSend`).
 */
function zuNachricht(row) {
  if (!row) return null;
  return {
    id: row.id,
    guildId: row.guild_id,
    roleId: row.role_id,
    title: row.title ?? '',
    body: row.body,
    templateId: row.template_id,
    buttonSetId: row.button_set_id ?? null,
    autoSend: row.auto_send === 1,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createRoleMessagesRepo(db) {
  const stmts = {
    all: db.prepare('SELECT * FROM role_messages WHERE guild_id = ? ORDER BY id'),
    byId: db.prepare('SELECT * FROM role_messages WHERE guild_id = ? AND id = ?'),
    autoForRole: db.prepare(`
      SELECT * FROM role_messages
       WHERE guild_id = ? AND role_id = ? AND enabled = 1 AND auto_send = 1
       ORDER BY id
    `),
    insert: db.prepare(`
      INSERT INTO role_messages
        (guild_id, role_id, title, body, template_id, button_set_id, auto_send, enabled,
         created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    update: db.prepare(`
      UPDATE role_messages
         SET role_id = ?, title = ?, body = ?, template_id = ?, button_set_id = ?,
             auto_send = ?, enabled = ?, updated_at = ?
       WHERE guild_id = ? AND id = ?
    `),
    del: db.prepare('DELETE FROM role_messages WHERE guild_id = ? AND id = ?'),
  };

  return {
    all: (guildId) => stmts.all.all(guildId).map(zuNachricht),
    byId: (guildId, id) => zuNachricht(stmts.byId.get(guildId, id)),
    /** Alle automatisch zu versendenden Nachrichten für eine gerade vergebene Rolle. */
    autoForRole: (guildId, roleId) => stmts.autoForRole.all(guildId, roleId).map(zuNachricht),

    create(guildId, {
      roleId, title = '', body, templateId = null, buttonSetId = null,
      autoSend = false, enabled = true,
    }) {
      const now = Date.now();
      const info = stmts.insert.run(
        guildId, roleId, title, body, templateId, buttonSetId,
        autoSend ? 1 : 0, enabled ? 1 : 0, now, now,
      );
      return this.byId(guildId, info.lastInsertRowid);
    },

    update(guildId, id, { roleId, title, body, templateId, buttonSetId, autoSend, enabled }) {
      stmts.update.run(
        roleId, title ?? '', body, templateId ?? null, buttonSetId ?? null,
        autoSend ? 1 : 0, enabled ? 1 : 0, Date.now(), guildId, id,
      );
      return this.byId(guildId, id);
    },

    delete(guildId, id) {
      stmts.del.run(guildId, id);
    },
  };
}
