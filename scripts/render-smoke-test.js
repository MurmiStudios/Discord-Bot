// Rendert jede Ansicht einmal mit plausiblen Beispiel-Daten, ohne HTTP oder
// Discord-Login -- faengt EJS-Tippfehler und fehlende Locals frueh ab.
// Aufruf: node scripts/render-smoke-test.js
process.env.NODE_ENV = 'test';
const path = require('path');
const ejs = require('ejs');
const icons = require('../src/web/icons');

const viewsDir = path.join(__dirname, '..', 'src', 'web', 'views');

const commonLocals = {
  title: 'Test',
  user: { id: '123', username: 'tester' },
  accessLabel: 'Panel-Administrator',
  currentPath: '/',
  baseUrl: 'http://localhost:3000',
  botOnline: true,
  icons,
  csrfToken: 'testtoken',
  flash: null,
  nav: [
    { label: 'Senden', items: [{ href: '/nachricht', label: 'Nachricht', icon: icons.message, badge: 'neu' }, { href: '/nachrichten', label: 'Gespeicherte Nachrichten', icon: icons.folder, count: 2 }] },
    { label: 'Verlauf', items: [{ href: '/', label: 'Übersicht', icon: icons.home }] },
  ],
};

const sampleValues = { content: 'Hallo {user}', embedEnabled: true, embed: { title: 'T', description: 'D', color: '#5865f2', footer: { text: 'F' }, fields: [{ name: 'N', value: 'V', inline: true }] }, imageTemplateId: null, actionBarId: null };
const sampleFieldRows = [{ name: '', value: '', inline: false }, { name: '', value: '', inline: false }];
const samplePreview = { content: 'Hallo Lena K.', embed: { title: 'T', description: 'D', fields: [{ name: 'N', value: 'V', inline: true }], footer: { text: 'F' } }, embedLength: 20, embedOverLimit: false, imageDataUrl: null, buttons: [{ label: 'Klick', style: 'blue', emoji: '👍' }] };

const cases = [
  ['login', { ...commonLocals, user: null, accessLabel: null, nav: null, authUrl: '#', bootstrapOpen: true }],
  ['errors/403', { ...commonLocals, reason: 'Testgrund' }],
  ['errors/404', { ...commonLocals }],
  ['dashboard', { ...commonLocals, guildName: 'Testserver', memberCount: 42, stats: { sent24h: 1, failed24h: 0, savedMessages: 2, activeRules: 1, totalRules: 2 }, attention: [{ text: 'X', href: '/', cta: 'Ansehen' }], automations: [{ name: 'Willkommen', desc: 'D', active: true, href: '/willkommen' }], recent: [{ summary: 'Test', reason: null, success: 1, created_at: '2026-01-01 12:00:00' }] }],
  ['message', { ...commonLocals, kind: 'dm', values: sampleValues, fieldRows: sampleFieldRows, imageTemplates: [{ id: 1, name: 'Vorlage' }], actionBars: [{ id: 1, name: 'Leiste' }], draftName: '', messageId: '', note: '', recipientChips: [{ id: '1', label: 'Lena K.', missing: false }], channel: null, channelGroups: { categories: [{ id: 'c1', name: 'Kategorie', channels: [{ id: 'ch1', name: 'general', announcement: false, can: true, reason: null }] }], uncategorized: [] }, preview: samplePreview, dmMaxRecipients: 200, dmDelayMs: 1500, contextLabel: 'Direktnachricht', savedMessages: [{ id: 1, name: 'Regeln', kind: 'dm', content: 'Hi' }] }],
  ['savedMessages', { ...commonLocals, filter: 'alle', items: [{ id: 1, name: 'Regeln', kind: 'dm', targetLabel: '2 Empfänger', missing: false, note: '' }], counts: { alle: 1, dm: 1, channel: 0 } }],
  ['welcome', { ...commonLocals, values: sampleValues, active: true, fieldRows: sampleFieldRows, imageTemplates: [], actionBars: [], preview: samplePreview, contextLabel: 'Direktnachricht bei Serverbeitritt' }],
  ['roleMessages', { ...commonLocals, roles: [{ id: 'r1', name: 'Verifiziert', memberCount: 10, hasMessage: true, selected: true }], selectedRoleId: 'r1', selectedRole: { id: 'r1', name: 'Verifiziert', memberCount: 10 }, values: sampleValues, active: true, fieldRows: sampleFieldRows, imageTemplates: [], actionBars: [], preview: samplePreview, contextLabel: 'Direktnachricht bei Rolle' }],
  ['roleRules', { ...commonLocals, roles: [{ id: 'r1', name: 'Verifiziert', memberCount: 10, lockReason: null }, { id: 'r2', name: 'Neu', memberCount: 5, lockReason: null }], editing: null, rules: [{ id: 1, description: 'Wer „Verifiziert“ erhält, verliert „Neu“.', note: '', active: true }], triggerRoleId: 'r1', removeRoleIds: ['r2'], note: '', active: true }],
  ['actionBars', { ...commonLocals, bars: [{ id: 1, name: 'Regeln', buttons: [{ id: 'b1', label: 'OK' }] }], editing: { id: 1, name: 'Regeln', buttons: [{ id: 'b1', label: 'OK', emoji: '', style: 'green', url: '', allowedRoleIds: [], replyText: '', actions: [{ type: 'role_add', roleId: 'r1' }] }] }, name: 'Regeln', buttonRows: [{ id: 'b1', label: 'OK', emoji: '', style: 'green', url: '', allowedRoleIds: [], replyText: '', actions: [{ type: 'role_add', roleId: 'r1' }] }, null, null], oncePerMember: false, ephemeralReply: true, roles: [{ id: 'r1', name: 'Verifiziert' }], maxButtons: 10, botCanKick: true, clickCounts: { b1: 3 } }],
  ['imageTemplates', { ...commonLocals, templates: [{ id: 1, name: 'Karte' }], editing: null, values: { name: '', preset: 'eigen', width: 1200, height: 500, bg_type: 'color', bg_color: '#5865f2', bg_image_path: null, bg_dim: 0, avatar: { enabled: true, shape: 'round', x: 80, y: 330, size: 90, border: 0 }, lines: [], align: 'left' }, lineRows: [{ text: '', size: 32, color: '#fff', align: 'left', maxWidth: '', shadow: false, x: '', y: '' }], previewDataUrl: null, maxLines: 4, botOnline: true }],
  ['feedback', { ...commonLocals, bars: [{ id: 1, name: 'Regeln' }], filterBarId: null, items: [{ id: 1, user_tag: 'lena', button_label: 'Frage', submitted_at: '2026-01-01 12:00:00', answers: [{ question: 'Warum?', answer: 'Weil' }] }] }],
  ['log', { ...commonLocals, kind: 'alle', search: '', page: 1, totalPages: 1, counts: { alle: 1, nachricht: 1, rolle: 0, anmeldung: 0, fehler: 0 }, groups: [{ label: 'Heute', entries: [{ summary: 'Test', reason: null, success: 1, created_at: '2026-01-01 12:00:00' }] }] }],
];

let failed = 0;
(async () => {
  for (const [view, locals] of cases) {
    try {
      await ejs.renderFile(path.join(viewsDir, view + '.ejs'), locals, { views: [viewsDir] });
      console.log(`OK   ${view}`);
    } catch (err) {
      failed++;
      console.error(`FAIL ${view}: ${err.message}`);
    }
  }
  process.exit(failed ? 1 : 0);
})();
