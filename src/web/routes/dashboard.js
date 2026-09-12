const express = require('express');
const repo = require('../../db/repo');
const { getGuild, isReady } = require('../../discord/client');

const router = express.Router();

router.get('/', (req, res) => {
  const guild = getGuild();
  const welcome = repo.welcome.get();
  const roleMessages = repo.roleMessages.list();
  const roleRules = repo.roleRules.list();
  const actionBars = repo.actionBars.list();
  const messages = repo.messages.list();
  const imageTemplates = repo.imageTemplates.list();

  const usedBarIds = new Set(
    [...messages, welcome, ...roleMessages].filter((m) => m && m.action_bar_id).map((m) => m.action_bar_id)
  );

  const attention = [];
  const failed24h = repo.audit.failedLast24h();
  if (failed24h > 0) attention.push({ text: `${failed24h} fehlgeschlagene Versände in den letzten 24 Stunden`, href: '/protokoll?kind=fehler', cta: 'Im Protokoll ansehen' });
  const inactiveRules = roleRules.filter((r) => !r.active).length;
  if (inactiveRules > 0) attention.push({ text: `${inactiveRules} Rollenregel${inactiveRules === 1 ? '' : 'n'} deaktiviert`, href: '/rollenregeln', cta: 'Regeln öffnen' });
  if (!welcome.active) attention.push({ text: 'Willkommensnachricht ausgeschaltet', href: '/willkommen', cta: 'Willkommen öffnen' });
  const unusedTemplates = imageTemplates.filter((t) => !repo.imageTemplates.usedByAny(t.id));
  if (unusedTemplates.length > 0) attention.push({ text: `${unusedTemplates.length} Bildvorlage${unusedTemplates.length === 1 ? '' : 'n'} unbenutzt`, href: '/vorlagen', cta: 'Vorlagen öffnen' });

  res.render('dashboard', {
    title: 'Übersicht',
    guildName: guild ? guild.name : null,
    memberCount: guild ? guild.memberCount : null,
    stats: {
      sent24h: repo.audit.sentLast24h(),
      failed24h: failed24h,
      savedMessages: messages.length,
      activeRules: roleRules.filter((r) => r.active).length,
      totalRules: roleRules.length,
    },
    attention,
    automations: [
      { name: 'Willkommensnachricht', desc: 'Geht bei jedem Serverbeitritt automatisch raus', active: !!welcome.active, href: '/willkommen' },
      { name: 'Rollen-Nachrichten', desc: `${roleMessages.filter((r) => r.active).length} Rolle${roleMessages.length === 1 ? '' : 'n'} mit eigener Nachricht`, active: roleMessages.some((r) => r.active), href: '/rollen-nachrichten' },
      { name: 'Rollenregeln', desc: `${roleRules.filter((r) => r.active).length} von ${roleRules.length} Regeln greifen beim Rollenwechsel`, active: roleRules.some((r) => r.active), href: '/rollenregeln' },
      { name: 'Aktionsleisten', desc: `${usedBarIds.size} von ${actionBars.length} Leisten in Nachrichten eingebunden`, active: usedBarIds.size > 0, href: '/aktionsleisten' },
    ],
    recent: repo.audit.recent(5),
    botOnline: isReady(),
  });
});

module.exports = router;
