const db = require('./index');

const j = (v) => (v == null ? null : JSON.stringify(v));
const p = (v, fallback) => {
  if (v == null) return fallback;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
};

function parseMessage(row) {
  if (!row) return row;
  return { ...row, embed: p(row.embed_json, null), target: p(row.target_json, null) };
}
function parseRoleMessage(row) {
  if (!row) return row;
  return { ...row, embed: p(row.embed_json, null) };
}
function parseActionBar(row) {
  if (!row) return row;
  return { ...row, buttons: p(row.buttons_json, []) };
}
function parseImageTemplate(row) {
  if (!row) return row;
  return { ...row, avatar: p(row.avatar_json, {}), lines: p(row.lines_json, []) };
}
function parseRoleRule(row) {
  if (!row) return row;
  return { ...row, removeRoleIds: p(row.remove_role_ids_json, []) };
}

// ---- Nachrichten (gespeicherte Vorlagen fuer DM/Kanal) ----
const messages = {
  list(kind) {
    const rows = kind
      ? db.prepare('SELECT * FROM messages WHERE kind = ? ORDER BY updated_at DESC').all(kind)
      : db.prepare('SELECT * FROM messages ORDER BY updated_at DESC').all();
    return rows.map(parseMessage);
  },
  get(id) {
    return parseMessage(db.prepare('SELECT * FROM messages WHERE id = ?').get(id));
  },
  create(data) {
    const info = db
      .prepare(
        `INSERT INTO messages (name, kind, content, embed_json, image_template_id, action_bar_id, target_json, note)
         VALUES (@name, @kind, @content, @embed_json, @image_template_id, @action_bar_id, @target_json, @note)`
      )
      .run({
        name: data.name,
        kind: data.kind,
        content: data.content || '',
        embed_json: j(data.embed),
        image_template_id: data.imageTemplateId || null,
        action_bar_id: data.actionBarId || null,
        target_json: j(data.target),
        note: data.note || '',
      });
    return this.get(info.lastInsertRowid);
  },
  update(id, data) {
    db.prepare(
      `UPDATE messages SET name=@name, kind=@kind, content=@content, embed_json=@embed_json,
         image_template_id=@image_template_id, action_bar_id=@action_bar_id, target_json=@target_json,
         note=@note, updated_at=datetime('now') WHERE id=@id`
    ).run({
      id,
      name: data.name,
      kind: data.kind,
      content: data.content || '',
      embed_json: j(data.embed),
      image_template_id: data.imageTemplateId || null,
      action_bar_id: data.actionBarId || null,
      target_json: j(data.target),
      note: data.note || '',
    });
    return this.get(id);
  },
  delete(id) {
    db.prepare('DELETE FROM messages WHERE id = ?').run(id);
  },
};

// ---- Willkommensnachricht (Singleton) ----
const welcome = {
  get() {
    const row = db.prepare('SELECT * FROM welcome_message WHERE id = 1').get();
    return parseRoleMessage(row);
  },
  save(data) {
    db.prepare(
      `UPDATE welcome_message SET content=@content, embed_json=@embed_json, image_template_id=@image_template_id,
         action_bar_id=@action_bar_id, active=@active, updated_at=datetime('now') WHERE id=1`
    ).run({
      content: data.content || '',
      embed_json: j(data.embed),
      image_template_id: data.imageTemplateId || null,
      action_bar_id: data.actionBarId || null,
      active: data.active ? 1 : 0,
    });
    return this.get();
  },
};

// ---- Rollen-Nachrichten ----
const roleMessages = {
  list() {
    return db.prepare('SELECT * FROM role_messages ORDER BY created_at ASC').all().map(parseRoleMessage);
  },
  get(id) {
    return parseRoleMessage(db.prepare('SELECT * FROM role_messages WHERE id = ?').get(id));
  },
  getByRole(roleId) {
    return parseRoleMessage(db.prepare('SELECT * FROM role_messages WHERE role_id = ?').get(roleId));
  },
  upsert(data) {
    const existing = this.getByRole(data.roleId);
    if (existing) {
      db.prepare(
        `UPDATE role_messages SET content=@content, embed_json=@embed_json, image_template_id=@image_template_id,
           action_bar_id=@action_bar_id, active=@active, updated_at=datetime('now') WHERE role_id=@roleId`
      ).run({
        roleId: data.roleId,
        content: data.content || '',
        embed_json: j(data.embed),
        image_template_id: data.imageTemplateId || null,
        action_bar_id: data.actionBarId || null,
        active: data.active ? 1 : 0,
      });
      return this.getByRole(data.roleId);
    }
    const info = db
      .prepare(
        `INSERT INTO role_messages (role_id, content, embed_json, image_template_id, action_bar_id, active)
         VALUES (@roleId, @content, @embed_json, @image_template_id, @action_bar_id, @active)`
      )
      .run({
        roleId: data.roleId,
        content: data.content || '',
        embed_json: j(data.embed),
        image_template_id: data.imageTemplateId || null,
        action_bar_id: data.actionBarId || null,
        active: data.active ? 1 : 0,
      });
    return this.get(info.lastInsertRowid);
  },
  delete(id) {
    db.prepare('DELETE FROM role_messages WHERE id = ?').run(id);
  },
};

// ---- Rollenregeln ----
const roleRules = {
  list() {
    return db.prepare('SELECT * FROM role_rules ORDER BY created_at ASC').all().map(parseRoleRule);
  },
  listActive() {
    return this.list().filter((r) => r.active);
  },
  get(id) {
    return parseRoleRule(db.prepare('SELECT * FROM role_rules WHERE id = ?').get(id));
  },
  create(data) {
    const info = db
      .prepare(
        `INSERT INTO role_rules (trigger_role_id, remove_role_ids_json, note, active)
         VALUES (@triggerRoleId, @removeRoleIdsJson, @note, @active)`
      )
      .run({
        triggerRoleId: data.triggerRoleId,
        removeRoleIdsJson: j(data.removeRoleIds || []),
        note: data.note || '',
        active: data.active ? 1 : 0,
      });
    return this.get(info.lastInsertRowid);
  },
  update(id, data) {
    db.prepare(
      `UPDATE role_rules SET trigger_role_id=@triggerRoleId, remove_role_ids_json=@removeRoleIdsJson,
         note=@note, active=@active, updated_at=datetime('now') WHERE id=@id`
    ).run({
      id,
      triggerRoleId: data.triggerRoleId,
      removeRoleIdsJson: j(data.removeRoleIds || []),
      note: data.note || '',
      active: data.active ? 1 : 0,
    });
    return this.get(id);
  },
  delete(id) {
    db.prepare('DELETE FROM role_rules WHERE id = ?').run(id);
  },
};

// ---- Aktionsleisten ----
const actionBars = {
  list() {
    return db.prepare('SELECT * FROM action_bars ORDER BY created_at ASC').all().map(parseActionBar);
  },
  get(id) {
    return parseActionBar(db.prepare('SELECT * FROM action_bars WHERE id = ?').get(id));
  },
  create(data) {
    const info = db
      .prepare(
        `INSERT INTO action_bars (name, buttons_json, once_per_member, ephemeral_reply)
         VALUES (@name, @buttonsJson, @oncePerMember, @ephemeralReply)`
      )
      .run({
        name: data.name,
        buttonsJson: j(data.buttons || []),
        oncePerMember: data.oncePerMember ? 1 : 0,
        ephemeralReply: data.ephemeralReply ? 1 : 0,
      });
    return this.get(info.lastInsertRowid);
  },
  update(id, data) {
    db.prepare(
      `UPDATE action_bars SET name=@name, buttons_json=@buttonsJson, once_per_member=@oncePerMember,
         ephemeral_reply=@ephemeralReply, updated_at=datetime('now') WHERE id=@id`
    ).run({
      id,
      name: data.name,
      buttonsJson: j(data.buttons || []),
      oncePerMember: data.oncePerMember ? 1 : 0,
      ephemeralReply: data.ephemeralReply ? 1 : 0,
    });
    return this.get(id);
  },
  delete(id) {
    db.prepare('DELETE FROM action_bars WHERE id = ?').run(id);
  },
};

// ---- Bildvorlagen ----
const imageTemplates = {
  list() {
    return db.prepare('SELECT * FROM image_templates ORDER BY created_at ASC').all().map(parseImageTemplate);
  },
  get(id) {
    if (!id) return null;
    return parseImageTemplate(db.prepare('SELECT * FROM image_templates WHERE id = ?').get(id));
  },
  create(data) {
    const info = db
      .prepare(
        `INSERT INTO image_templates (name, width, height, bg_type, bg_color, bg_image_path, bg_dim, avatar_json, lines_json, align)
         VALUES (@name, @width, @height, @bgType, @bgColor, @bgImagePath, @bgDim, @avatarJson, @linesJson, @align)`
      )
      .run(toImageTemplateParams(data));
    return this.get(info.lastInsertRowid);
  },
  update(id, data) {
    db.prepare(
      `UPDATE image_templates SET name=@name, width=@width, height=@height, bg_type=@bgType, bg_color=@bgColor,
         bg_image_path=@bgImagePath, bg_dim=@bgDim, avatar_json=@avatarJson, lines_json=@linesJson, align=@align,
         updated_at=datetime('now') WHERE id=@id`
    ).run({ ...toImageTemplateParams(data), id });
    return this.get(id);
  },
  delete(id) {
    db.prepare('DELETE FROM image_templates WHERE id = ?').run(id);
  },
  usedByAny(id) {
    const inMessages = db.prepare('SELECT 1 FROM messages WHERE image_template_id = ? LIMIT 1').get(id);
    const inWelcome = db.prepare('SELECT 1 FROM welcome_message WHERE image_template_id = ? LIMIT 1').get(id);
    const inRoleMsg = db.prepare('SELECT 1 FROM role_messages WHERE image_template_id = ? LIMIT 1').get(id);
    return !!(inMessages || inWelcome || inRoleMsg);
  },
};

function toImageTemplateParams(data) {
  return {
    name: data.name,
    width: data.width,
    height: data.height,
    bgType: data.bgType || 'color',
    bgColor: data.bgColor || '#5865f2',
    bgImagePath: data.bgImagePath || null,
    bgDim: data.bgDim || 0,
    avatarJson: j(data.avatar || {}),
    linesJson: j(data.lines || []),
    align: data.align || 'left',
  };
}

// ---- Rückmeldungen ----
const feedback = {
  list({ actionBarId } = {}) {
    if (actionBarId) {
      return db
        .prepare('SELECT * FROM feedback_responses WHERE action_bar_id = ? ORDER BY submitted_at DESC')
        .all(actionBarId)
        .map((r) => ({ ...r, answers: p(r.answers_json, []) }));
    }
    return db
      .prepare('SELECT * FROM feedback_responses ORDER BY submitted_at DESC')
      .all()
      .map((r) => ({ ...r, answers: p(r.answers_json, []) }));
  },
  create(data) {
    db.prepare(
      `INSERT INTO feedback_responses (action_bar_id, button_id, button_label, user_id, user_tag, answers_json)
       VALUES (@actionBarId, @buttonId, @buttonLabel, @userId, @userTag, @answersJson)`
    ).run({
      actionBarId: data.actionBarId || null,
      buttonId: data.buttonId || null,
      buttonLabel: data.buttonLabel || '',
      userId: data.userId,
      userTag: data.userTag,
      answersJson: j(data.answers || []),
    });
  },
  delete(id) {
    db.prepare('DELETE FROM feedback_responses WHERE id = ?').run(id);
  },
};

// ---- Protokoll ----
const audit = {
  log({ kind, actorId = null, actorTag = null, summary, detail = null, success = true, reason = null }) {
    db.prepare(
      `INSERT INTO audit_log (kind, actor_id, actor_tag, summary, detail_json, success, reason)
       VALUES (@kind, @actorId, @actorTag, @summary, @detailJson, @success, @reason)`
    ).run({ kind, actorId, actorTag, summary, detailJson: j(detail), success: success ? 1 : 0, reason });
  },
  list({ kind, search, page = 1, pageSize = 50 } = {}) {
    const where = [];
    const params = {};
    if (kind && kind !== 'alle') {
      where.push('kind = @kind');
      params.kind = kind;
    }
    if (search) {
      where.push('(summary LIKE @search OR actor_tag LIKE @search OR reason LIKE @search)');
      params.search = `%${search}%`;
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = db.prepare(`SELECT COUNT(*) AS c FROM audit_log ${whereSql}`).get(params).c;
    const rows = db
      .prepare(`SELECT * FROM audit_log ${whereSql} ORDER BY created_at DESC, id DESC LIMIT @limit OFFSET @offset`)
      .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize });
    return { rows: rows.map((r) => ({ ...r, detail: p(r.detail_json, null) })), total, page, pageSize };
  },
  counts() {
    const rows = db.prepare('SELECT kind, COUNT(*) AS c FROM audit_log GROUP BY kind').all();
    const out = { alle: 0, nachricht: 0, rolle: 0, anmeldung: 0, fehler: 0 };
    for (const r of rows) {
      out[r.kind] = r.c;
      out.alle += r.c;
    }
    return out;
  },
  recent(limit = 5) {
    return db.prepare('SELECT * FROM audit_log ORDER BY created_at DESC, id DESC LIMIT ?').all(limit);
  },
  failedLast24h() {
    return db
      .prepare(
        "SELECT COUNT(*) AS c FROM audit_log WHERE kind='nachricht' AND success=0 AND created_at >= datetime('now','-1 day')"
      )
      .get().c;
  },
  sentLast24h() {
    return db
      .prepare("SELECT COUNT(*) AS c FROM audit_log WHERE kind='nachricht' AND success=1 AND created_at >= datetime('now','-1 day')")
      .get().c;
  },
};

// ---- Button-Klicks (Sperre "nur einmal je Mitglied" + Zähler) ----
const buttonClicks = {
  hasClicked(actionBarId, buttonId, userId) {
    return !!db
      .prepare('SELECT 1 FROM button_clicks WHERE action_bar_id=? AND button_id=? AND user_id=?')
      .get(actionBarId, buttonId, userId);
  },
  record(actionBarId, buttonId, userId) {
    db.prepare(
      'INSERT OR IGNORE INTO button_clicks (action_bar_id, button_id, user_id) VALUES (?,?,?)'
    ).run(actionBarId, buttonId, userId);
  },
  count(actionBarId, buttonId) {
    return db
      .prepare('SELECT COUNT(*) AS c FROM button_clicks WHERE action_bar_id=? AND button_id=?')
      .get(actionBarId, buttonId).c;
  },
  reset(actionBarId, buttonId) {
    db.prepare('DELETE FROM button_clicks WHERE action_bar_id=? AND button_id=?').run(actionBarId, buttonId);
  },
};

// ---- Erste-Anmeldung-wird-Admin (siehe discord/permissions.js) ----
const adminBootstrap = {
  // Traegt userId ein, falls noch niemand gewonnen hat, und gibt in jedem
  // Fall die (dann feststehende) gewinnende User-ID zurueck.
  getOrGrant(userId) {
    db.prepare(
      "INSERT INTO admin_bootstrap (id, granted_user_id) VALUES (1, @userId) ON CONFLICT(id) DO NOTHING"
    ).run({ userId });
    return db.prepare('SELECT granted_user_id FROM admin_bootstrap WHERE id = 1').get().granted_user_id;
  },
  get() {
    const row = db.prepare('SELECT granted_user_id, granted_at FROM admin_bootstrap WHERE id = 1').get();
    return row || null;
  },
};

module.exports = { messages, welcome, roleMessages, roleRules, actionBars, imageTemplates, feedback, audit, buttonClicks, adminBootstrap };
