const express = require('express');
const repo = require('../../db/repo');
const { parseComposerBody, embedFieldRows, emptyComposerValues } = require('../composerForm');
const { buildPreviewData, buildMessagePayload } = require('../../discord/renderer');
const { sampleContext } = require('../sampleContext');
const { getGuild, isReady } = require('../../discord/client');
const { bulkSendDm } = require('../../discord/send');
const { ctxForMember } = require('../../discord/context');
const { send: sendLimiter } = require('../middleware/rateLimit');

const router = express.Router();

function rolesWithFlags(guild, selectedId) {
  if (!guild) return [];
  return [...guild.roles.cache.values()]
    .filter((r) => r.id !== guild.id)
    .sort((a, b) => b.position - a.position)
    .map((r) => ({ id: r.id, name: r.name, memberCount: r.members.size, hasMessage: !!repo.roleMessages.getByRole(r.id), selected: r.id === selectedId }));
}

router.get('/rollen-nachrichten', async (req, res) => {
  const guild = getGuild();
  const roles = rolesWithFlags(guild, req.query.role);
  const selectedRoleId = req.query.role || (roles.find((r) => r.hasMessage) || roles[0] || {}).id || '';

  const rm = selectedRoleId ? repo.roleMessages.getByRole(selectedRoleId) : null;
  const values = rm
    ? { content: rm.content, embedEnabled: !!rm.embed, embed: rm.embed, imageTemplateId: rm.image_template_id, actionBarId: rm.action_bar_id }
    : emptyComposerValues();
  const active = rm ? !!rm.active : true;
  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  const preview = await buildPreviewData(
    {
      content: values.content,
      embed: values.embedEnabled ? values.embed : null,
      imageTemplate: repo.imageTemplates.get(values.imageTemplateId),
      actionBar: repo.actionBars.get(values.actionBarId),
    },
    sampleContext({ roleName: selectedRole ? selectedRole.name : '' })
  );

  res.render('roleMessages', {
    title: 'Rollen-Nachrichten',
    roles,
    selectedRoleId,
    selectedRole,
    values,
    active,
    fieldRows: embedFieldRows(values.embed),
    imageTemplates: repo.imageTemplates.list(),
    actionBars: repo.actionBars.list(),
    preview,
    contextLabel: selectedRole ? `Direktnachricht bei Rolle „${selectedRole.name}“` : 'Direktnachricht bei Rollenerhalt',
  });
});

router.post('/rollen-nachrichten/speichern', (req, res) => {
  const roleId = req.body.roleId;
  if (!roleId) return res.redirect('/rollen-nachrichten');
  const composed = parseComposerBody(req.body);
  repo.roleMessages.upsert({ roleId, ...composed, active: req.body.active === 'on' });
  req.session.flash = { type: 'success', text: 'Rollen-Nachricht gespeichert.' };
  res.redirect(`/rollen-nachrichten?role=${roleId}`);
});

router.post('/rollen-nachrichten/senden-an-alle', sendLimiter, async (req, res) => {
  const roleId = req.body.roleId;
  const guild = getGuild();
  if (!isReady() || !guild) {
    req.session.flash = { type: 'danger', text: 'Bot ist nicht verbunden.' };
    return res.redirect(`/rollen-nachrichten?role=${roleId}`);
  }
  const role = guild.roles.cache.get(roleId);
  const rm = repo.roleMessages.getByRole(roleId);
  if (!role || !rm) {
    req.session.flash = { type: 'danger', text: 'Für diese Rolle ist keine Nachricht gespeichert.' };
    return res.redirect(`/rollen-nachrichten?role=${roleId}`);
  }

  await guild.members.fetch();
  const users = [...role.members.values()].map((m) => m.user);
  const imageTemplate = repo.imageTemplates.get(rm.image_template_id);
  const actionBar = repo.actionBars.get(rm.action_bar_id);

  const result = await bulkSendDm(
    users,
    async (user) => {
      const member = await guild.members.fetch(user.id).catch(() => null);
      const ctx = ctxForMember(member || { user, displayName: user.username, displayAvatarURL: user.displayAvatarURL.bind(user) }, guild, { roleName: role.name });
      return buildMessagePayload({ content: rm.content, embed: rm.embed, imageTemplate, actionBar }, ctx);
    },
    { actorId: req.session.user.id, actorTag: req.session.user.username, logSummary: `Rollen-DM „${role.name}“` }
  );

  req.session.flash = { type: result.failed ? 'warning' : 'success', text: `${result.sent} zugestellt, ${result.failed} fehlgeschlagen.` };
  res.redirect(`/rollen-nachrichten?role=${roleId}`);
});

module.exports = router;
