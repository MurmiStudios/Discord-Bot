/**
 * Protokoll aller Versand- und Regel-Vorgänge.
 *
 * Dient zwei Zwecken: Nachvollziehbarkeit im Panel ("wurde die DM zugestellt?")
 * und Fehlersuche ("warum wurde Rolle X nicht entfernt?").
 */
export const LOG_ARTEN = ['dm', 'role_dm', 'welcome_dm', 'channel', 'button', 'rule_applied', 'auth', 'error'];
export const LOG_STATUS = ['ok', 'failed', 'skipped'];

function zuEintrag(row) {
  return {
    id: row.id,
    guildId: row.guild_id,
    ts: row.ts,
    kind: row.kind,
    actorId: row.actor_id,
    targetUserId: row.target_user_id,
    targetChannelId: row.target_channel_id,
    templateId: row.template_id,
    status: row.status,
    errorCode: row.error_code,
    detail: row.detail ?? '',
    payloadExcerpt: row.payload_excerpt ?? '',
  };
}

export function createLogRepo(db) {
  const stmts = {
    insert: db.prepare(`
      INSERT INTO send_log
        (guild_id, ts, kind, actor_id, target_user_id, target_channel_id,
         template_id, status, error_code, detail, payload_excerpt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    recent: db.prepare(`
      SELECT * FROM send_log WHERE guild_id = ? ORDER BY ts DESC, id DESC LIMIT ? OFFSET ?
    `),
    recentByKind: db.prepare(`
      SELECT * FROM send_log WHERE guild_id = ? AND kind = ? ORDER BY ts DESC, id DESC LIMIT ? OFFSET ?
    `),
    count: db.prepare('SELECT COUNT(*) AS n FROM send_log WHERE guild_id = ?'),
    countByKind: db.prepare('SELECT COUNT(*) AS n FROM send_log WHERE guild_id = ? AND kind = ?'),
    countStatusSince: db.prepare(`
      SELECT status, COUNT(*) AS n FROM send_log
       WHERE guild_id = ? AND ts >= ? GROUP BY status
    `),
    purgeOlderThan: db.prepare('DELETE FROM send_log WHERE ts < ?'),
  };

  return {
    add(guildId, {
      kind, status, actorId = null, targetUserId = null, targetChannelId = null,
      templateId = null, errorCode = null, detail = '', payloadExcerpt = '',
    }) {
      stmts.insert.run(
        guildId, Date.now(), kind, actorId, targetUserId, targetChannelId, templateId,
        status, errorCode,
        // Detail und Auszug werden im Panel angezeigt — hart begrenzen, damit
        // eine lange Fehlermeldung die Tabelle nicht sprengt.
        String(detail).slice(0, 500),
        String(payloadExcerpt).slice(0, 200),
      );
    },

    recent(guildId, { limit = 50, offset = 0, kind = null } = {}) {
      const rows = kind
        ? stmts.recentByKind.all(guildId, kind, limit, offset)
        : stmts.recent.all(guildId, limit, offset);
      return rows.map(zuEintrag);
    },

    count(guildId, kind = null) {
      return kind ? stmts.countByKind.get(guildId, kind).n : stmts.count.get(guildId).n;
    },

    /** Kennzahlen fürs Dashboard: Erfolge/Fehler der letzten N Stunden. */
    statusSince(guildId, seitMs) {
      const out = { ok: 0, failed: 0, skipped: 0 };
      for (const row of stmts.countStatusSince.all(guildId, seitMs)) out[row.status] = row.n;
      return out;
    },

    purgeOlderThan(ts) {
      return stmts.purgeOlderThan.run(ts).changes;
    },
  };
}
