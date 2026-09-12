// Ein gemeinsamer Platzhalter-Ersetzer fuer Text, Embed-Felder und Bildvorlagen.
// ctx-Felder sind alle optional; fehlende Platzhalter werden durch einen leeren
// String ersetzt statt den Text kaputt stehen zu lassen.
function apply(text, ctx = {}) {
  if (!text) return text;
  const map = {
    user: ctx.userName || '',
    tag: ctx.userTag || '',
    guild: ctx.guildName || '',
    role: ctx.roleName || '',
    count: ctx.memberCount != null ? String(ctx.memberCount) : '',
    clicker: ctx.clickerName || '',
    clicker_tag: ctx.clickerTag || '',
    feedback: ctx.feedback || '',
  };
  return text.replace(/\{(\w+)\}/g, (m, key) => (key in map ? map[key] : m));
}

function applyDeep(value, ctx) {
  if (typeof value === 'string') return apply(value, ctx);
  if (Array.isArray(value)) return value.map((v) => applyDeep(v, ctx));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = applyDeep(v, ctx);
    return out;
  }
  return value;
}

const PLACEHOLDER_KEYS = ['user', 'tag', 'guild', 'role', 'count'];

module.exports = { apply, applyDeep, PLACEHOLDER_KEYS };
