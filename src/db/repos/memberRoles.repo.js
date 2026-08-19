/**
 * Rollen-Momentaufnahme je Mitglied.
 *
 * Das ist die massgebliche Quelle für den Rollen-Diff — bewusst NICHT
 * `oldMember` aus dem Discord-Ereignis: das ist nur gefüllt, wenn das Mitglied
 * im Cache lag. Nach einem Neustart wäre es unvollständig, der Diff würde
 * fälschlich "alles neu hinzugefügt" melden und Massen-Entfernungen auslösen.
 */
const sortiert = (ids) => [...new Set(ids)].sort();

export function createMemberRolesRepo(db) {
  const stmts = {
    get: db.prepare('SELECT role_ids FROM member_roles WHERE guild_id = ? AND user_id = ?'),
    put: db.prepare(`
      INSERT INTO member_roles (guild_id, user_id, role_ids, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT (guild_id, user_id)
      DO UPDATE SET role_ids = excluded.role_ids, updated_at = excluded.updated_at
    `),
    del: db.prepare('DELETE FROM member_roles WHERE guild_id = ? AND user_id = ?'),
    count: db.prepare('SELECT COUNT(*) AS n FROM member_roles WHERE guild_id = ?'),
    clear: db.prepare('DELETE FROM member_roles WHERE guild_id = ?'),
  };

  return {
    /** @returns {string[]|null} null bedeutet "noch nie gesehen". */
    get(guildId, userId) {
      const row = stmts.get.get(guildId, userId);
      if (!row) return null;
      try {
        const parsed = JSON.parse(row.role_ids);
        return Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    },

    put(guildId, userId, roleIds) {
      stmts.put.run(guildId, userId, JSON.stringify(sortiert(roleIds)), Date.now());
    },

    /** Startbefüllung: alle Mitglieder in einer einzigen Transaktion. */
    putMany(guildId, eintraege) {
      const now = Date.now();
      db.transaction((liste) => {
        for (const { userId, roleIds } of liste) {
          stmts.put.run(guildId, userId, JSON.stringify(sortiert(roleIds)), now);
        }
      })(eintraege);
    },

    delete(guildId, userId) {
      stmts.del.run(guildId, userId);
    },

    count(guildId) {
      return stmts.count.get(guildId).n;
    },

    clear(guildId) {
      stmts.clear.run(guildId);
    },
  };
}
