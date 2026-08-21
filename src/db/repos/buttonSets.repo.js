/**
 * Aktionsleisten und ihre Buttons.
 *
 * Eine Leiste ist wiederverwendbar: sie wird einmal angelegt und dann an
 * beliebige Nachrichten gehängt. Ändert man sie, wirkt das überall — allerdings
 * erst bei neu versendeten Nachrichten, denn Discord speichert die Buttons in
 * der bereits zugestellten Nachricht.
 */
function zuSet(row) {
  if (!row) return null;
  return {
    id: row.id,
    guildId: row.guild_id,
    name: row.name,
    note: row.note ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function jsonListe(text) {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function zuButton(row) {
  if (!row) return null;
  return {
    id: row.id,
    setId: row.set_id,
    position: row.position,
    label: row.label,
    style: row.style,
    emoji: row.emoji ?? '',
    actions: jsonListe(row.actions),
    allowedRoleIds: jsonListe(row.allowed_role_ids),
    oncePerUser: row.once_per_user === 1,
    replyText: row.reply_text ?? '',
    enabled: row.enabled === 1,
  };
}

export function createButtonSetsRepo(db) {
  const stmts = {
    alleSets: db.prepare('SELECT * FROM button_sets WHERE guild_id = ? ORDER BY name'),
    setById: db.prepare('SELECT * FROM button_sets WHERE guild_id = ? AND id = ?'),
    setEinfuegen: db.prepare(`
      INSERT INTO button_sets (guild_id, name, note, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `),
    setAendern: db.prepare(`
      UPDATE button_sets SET name = ?, note = ?, updated_at = ? WHERE guild_id = ? AND id = ?
    `),
    setLoeschen: db.prepare('DELETE FROM button_sets WHERE guild_id = ? AND id = ?'),

    buttonsVonSet: db.prepare('SELECT * FROM buttons WHERE set_id = ? ORDER BY position, id'),
    buttonById: db.prepare('SELECT * FROM buttons WHERE id = ?'),
    buttonEinfuegen: db.prepare(`
      INSERT INTO buttons
        (set_id, position, label, style, emoji, actions, allowed_role_ids,
         once_per_user, reply_text, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    buttonAendern: db.prepare(`
      UPDATE buttons
         SET label = ?, style = ?, emoji = ?, actions = ?, allowed_role_ids = ?,
             once_per_user = ?, reply_text = ?, enabled = ?, updated_at = ?
       WHERE id = ?
    `),
    buttonLoeschen: db.prepare('DELETE FROM buttons WHERE id = ?'),
    naechstePosition: db.prepare(
      'SELECT COALESCE(MAX(position), -1) + 1 AS p FROM buttons WHERE set_id = ?',
    ),
    anzahlImSet: db.prepare('SELECT COUNT(*) AS n FROM buttons WHERE set_id = ?'),

    nutzungMerken: db.prepare(
      'INSERT OR IGNORE INTO button_uses (button_id, user_id, used_at) VALUES (?, ?, ?)',
    ),
    nutzungPruefen: db.prepare(
      'SELECT 1 FROM button_uses WHERE button_id = ? AND user_id = ?',
    ),
    nutzungenZuruecksetzen: db.prepare('DELETE FROM button_uses WHERE button_id = ?'),
    nutzungLoesen: db.prepare('DELETE FROM button_uses WHERE button_id = ? AND user_id = ?'),
    anzahlNutzungen: db.prepare('SELECT COUNT(*) AS n FROM button_uses WHERE button_id = ?'),
  };

  return {
    alleSets: (guildId) => stmts.alleSets.all(guildId).map(zuSet),
    setById: (guildId, id) => zuSet(stmts.setById.get(guildId, id)),

    createSet(guildId, { name, note = '' }) {
      const now = Date.now();
      const info = stmts.setEinfuegen.run(guildId, name, note, now, now);
      return this.setById(guildId, info.lastInsertRowid);
    },

    updateSet(guildId, id, { name, note = '' }) {
      stmts.setAendern.run(name, note, Date.now(), guildId, id);
      return this.setById(guildId, id);
    },

    deleteSet(guildId, id) {
      // Die Buttons hängen per ON DELETE CASCADE daran; foreign_keys ist in
      // db/index.js eingeschaltet, sonst blieben sie als Waisen zurück.
      stmts.setLoeschen.run(guildId, id);
    },

    buttons: (setId) => stmts.buttonsVonSet.all(setId).map(zuButton),
    buttonById: (id) => zuButton(stmts.buttonById.get(id)),
    anzahlImSet: (setId) => stmts.anzahlImSet.get(setId).n,

    /** Leiste samt Buttons — das braucht der Nachrichtenaufbau. */
    setMitButtons(guildId, id) {
      const set = this.setById(guildId, id);
      if (!set) return null;
      return { ...set, buttons: this.buttons(id) };
    },

    createButton(setId, daten) {
      const now = Date.now();
      const position = stmts.naechstePosition.get(setId).p;
      const info = stmts.buttonEinfuegen.run(
        setId,
        position,
        daten.label,
        daten.style,
        daten.emoji || null,
        JSON.stringify(daten.actions ?? []),
        JSON.stringify(daten.allowedRoleIds ?? []),
        daten.oncePerUser ? 1 : 0,
        daten.replyText ?? '',
        daten.enabled === false ? 0 : 1,
        now,
        now,
      );
      return this.buttonById(info.lastInsertRowid);
    },

    updateButton(id, daten) {
      stmts.buttonAendern.run(
        daten.label,
        daten.style,
        daten.emoji || null,
        JSON.stringify(daten.actions ?? []),
        JSON.stringify(daten.allowedRoleIds ?? []),
        daten.oncePerUser ? 1 : 0,
        daten.replyText ?? '',
        daten.enabled === false ? 0 : 1,
        Date.now(),
        id,
      );
      return this.buttonById(id);
    },

    deleteButton(id) {
      stmts.buttonLoeschen.run(id);
    },

    /**
     * Merkt eine Nutzung vor. Gibt false zurück, wenn das Mitglied den Button
     * schon benutzt hat — die Prüfung steckt im Primärschlüssel, damit auch
     * zwei gleichzeitige Klicks nicht beide durchkommen.
     */
    nutzungVormerken(buttonId, userId) {
      return stmts.nutzungMerken.run(buttonId, userId, Date.now()).changes === 1;
    },

    hatBenutzt: (buttonId, userId) => Boolean(stmts.nutzungPruefen.get(buttonId, userId)),
    nutzungenZuruecksetzen: (buttonId) => stmts.nutzungenZuruecksetzen.run(buttonId).changes,
    /** Löst die Einmal-Sperre für ein einzelnes Mitglied wieder. */
    nutzungLoesen: (buttonId, userId) => stmts.nutzungLoesen.run(buttonId, userId).changes,
    anzahlNutzungen: (buttonId) => stmts.anzahlNutzungen.get(buttonId).n,
  };
}
