const express = require('express');
const crypto = require('crypto');
const repo = require('../../db/repo');
const { getGuild } = require('../../discord/client');
const { PermissionsBitField } = require('discord.js');

const router = express.Router();
const MAX_BUTTONS = 10;

function rolesForSelect(guild) {
  if (!guild) return [];
  return [...guild.roles.cache.values()]
    .filter((r) => r.id !== guild.id)
    .sort((a, b) => b.position - a.position)
    .map((r) => ({ id: r.id, name: r.name }));
}

// Baut aus den POST-Feldern buttons[N][...] die Button-Liste. Feste Anzahl
// Zeilen (max. 10) statt eines dynamisch wachsenden Arrays -- einfacher ohne
// JavaScript nutzbar, siehe README fuer die bewusste Vereinfachung.
function parseButtons(body) {
  const raw = body.buttons || {};
  const buttons = [];
  Object.keys(raw)
    .sort((a, b) => Number(a) - Number(b))
    .slice(0, MAX_BUTTONS)
    .forEach((key) => {
      const b = raw[key];
      if (!b || !b.label || !b.label.trim()) return;

      const style = b.style || 'grey';
      const action = style === 'link' ? 'link' : b.action || 'none';
      const allowedRoleIds = Array.isArray(b.allowedRoleIds) ? b.allowedRoleIds.filter(Boolean) : b.allowedRoleIds ? [b.allowedRoleIds] : [];

      const actions = [];
      if (action === 'dm_clicker') actions.push({ type: 'dm_clicker', content: b.content || '' });
      else if (action === 'dm_fixed')
        actions.push({
          type: 'dm_fixed',
          targetMode: b.targetMode === 'pick' ? 'pick' : 'fixed',
          targetUserId: b.targetUserId || '',
          restrictRoleId: b.restrictRoleId || '',
          content: b.content || '',
        });
      else if (['role_add', 'role_remove', 'role_toggle'].includes(action)) actions.push({ type: action, roleId: b.roleId || '' });
      else if (action === 'feedback_modal') {
        const fields = (b.feedbackFields ? Object.values(b.feedbackFields) : [])
          .filter((f) => f && f.label && f.label.trim())
          .slice(0, 5)
          .map((f) => ({ label: f.label.trim(), style: f.fieldStyle === 'paragraph' ? 'paragraph' : 'short', required: f.required === 'on', placeholder: f.placeholder || '' }));
        actions.push({ type: 'feedback_modal', title: b.feedbackTitle || 'Rückmeldung', fields });
      } else if (action === 'kick') actions.push({ type: 'kick', reason: b.reason || '', escapeRoleId: b.escapeRoleId || '' });

      buttons.push({
        id: b.id || crypto.randomBytes(6).toString('hex'),
        label: b.label.trim().slice(0, 80),
        emoji: (b.emoji || '').trim().slice(0, 8),
        style,
        url: style === 'link' ? b.url || '' : '',
        allowedRoleIds,
        replyText: b.replyText || '',
        actions,
      });
    });
  return buttons;
}

router.get('/aktionsleisten', (req, res) => {
  const guild = getGuild();
  let editing = null;
  if (req.query.edit) editing = repo.actionBars.get(Number(req.query.edit));

  const buttons = editing ? editing.buttons : [];
  const clickCounts = {};
  if (editing) buttons.forEach((b) => (clickCounts[b.id] = repo.buttonClicks.count(editing.id, b.id)));
  const padded = buttons.slice(0, MAX_BUTTONS);
  while (padded.length < 3) padded.push(null); // mindestens 3 leere Zeilen zum Anlegen anbieten

  res.render('actionBars', {
    title: 'Aktionsleisten',
    bars: repo.actionBars.list(),
    editing,
    name: editing ? editing.name : '',
    buttonRows: padded,
    oncePerMember: editing ? !!editing.once_per_member : false,
    ephemeralReply: editing ? !!editing.ephemeral_reply : true,
    roles: rolesForSelect(guild),
    maxButtons: MAX_BUTTONS,
    botCanKick: !!(guild && guild.members.me && guild.members.me.permissions.has(PermissionsBitField.Flags.KickMembers)),
    clickCounts,
  });
});

router.post('/aktionsleisten/speichern', (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) {
    req.session.flash = { type: 'danger', text: 'Bitte einen Namen für die Leiste eintragen.' };
    return res.redirect('/aktionsleisten');
  }
  const data = {
    name,
    buttons: parseButtons(req.body),
    oncePerMember: req.body.oncePerMember === 'on',
    ephemeralReply: req.body.ephemeralReply === 'on',
  };
  const saved = req.body.barId ? repo.actionBars.update(Number(req.body.barId), data) : repo.actionBars.create(data);
  req.session.flash = { type: 'success', text: 'Aktionsleiste gespeichert.' };
  res.redirect(`/aktionsleisten?edit=${saved.id}`);
});

router.post('/aktionsleisten/:id/loeschen', (req, res) => {
  repo.actionBars.delete(Number(req.params.id));
  req.session.flash = { type: 'success', text: 'Aktionsleiste gelöscht.' };
  res.redirect('/aktionsleisten');
});

router.post('/aktionsleisten/:id/sperre-loeschen', (req, res) => {
  const buttonId = req.body.buttonId;
  repo.buttonClicks.reset(Number(req.params.id), buttonId);
  req.session.flash = { type: 'success', text: 'Klick-Sperre zurückgesetzt.' };
  res.redirect(`/aktionsleisten?edit=${req.params.id}`);
});

module.exports = router;
