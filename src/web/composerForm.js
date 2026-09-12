const MAX_FIELDS = 5;

function normalizeIds(v) {
  if (v == null || v === '') return [];
  return Array.isArray(v) ? v.filter(Boolean) : [v];
}

// Liest die Formularfelder eines Nachrichten-Composers (Text, Embed,
// Bildvorlage, Aktionsleiste) aus dem POST-Body. Dieselbe Funktion fuer
// /nachricht, /willkommen und /rollen-nachrichten.
function parseComposerBody(body) {
  const embedEnabled = body.embedEnabled === 'on';
  const rawFields = (body.embed && body.embed.fields) || {};
  const fields = Object.keys(rawFields)
    .sort()
    .map((k) => rawFields[k])
    .filter((f) => f && (f.name || '').trim() && (f.value || '').trim())
    .slice(0, MAX_FIELDS)
    .map((f) => ({ name: f.name.trim(), value: f.value.trim(), inline: f.inline === 'on' }));

  const embed = embedEnabled
    ? {
        title: (body.embed && body.embed.title) || '',
        description: (body.embed && body.embed.description) || '',
        color: (body.embed && body.embed.color) || '#5865f2',
        footer: { text: (body.embed && body.embed.footer) || '' },
        fields,
      }
    : null;

  return {
    content: (body.content || '').slice(0, 2000),
    embedEnabled,
    embed,
    imageTemplateId: body.imageTemplateId ? Number(body.imageTemplateId) : null,
    actionBarId: body.actionBarId ? Number(body.actionBarId) : null,
  };
}

// Baut aus einem gespeicherten Embed die feste Anzahl Feld-Zeilen fuer das
// Formular (leere Zeilen am Ende zum Ausfuellen).
function embedFieldRows(embed) {
  const existing = (embed && embed.fields) || [];
  const rows = existing.slice(0, MAX_FIELDS).map((f) => ({ name: f.name, value: f.value, inline: !!f.inline }));
  while (rows.length < MAX_FIELDS) rows.push({ name: '', value: '', inline: false });
  return rows;
}

function emptyComposerValues() {
  return { content: '', embedEnabled: false, embed: null, imageTemplateId: null, actionBarId: null };
}

module.exports = { parseComposerBody, embedFieldRows, normalizeIds, emptyComposerValues, MAX_FIELDS };
