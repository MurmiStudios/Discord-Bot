const express = require('express');
const repo = require('../../db/repo');
const { getGuild } = require('../../discord/client');
const { roleLockReason } = require('../../discord/permissions');
const { normalizeIds } = require('../composerForm');

const router = express.Router();

function roleList(guild) {
  if (!guild) return [];
  return [...guild.roles.cache.values()]
    .filter((r) => r.id !== guild.id)
    .sort((a, b) => b.position - a.position)
    .map((r) => ({ id: r.id, name: r.name, memberCount: r.members.size, lockReason: roleLockReason(guild, r) }));
}

function describeRule(rule, roles) {
  const byId = new Map(roles.map((r) => [r.id, r.name]));
  const trigger = byId.get(rule.triggerRoleId) || rule.triggerRoleId;
  const removes = rule.removeRoleIds.map((id) => byId.get(id) || id);
  if (!removes.length) return `Wer „${trigger}“ erhält, verliert nichts weiter.`;
  return `Wer „${trigger}“ erhält, verliert „${removes.join('“, „')}“.`;
}

router.get('/rollenregeln', (req, res) => {
  const guild = getGuild();
  const roles = roleList(guild);

  let editing = null;
  if (req.query.edit) editing = repo.roleRules.get(Number(req.query.edit));

  const rules = repo.roleRules.list().map((r) => ({ ...r, description: describeRule(r, roles) }));

  res.render('roleRules', {
    title: 'Rollenregeln',
    roles,
    editing,
    rules,
    triggerRoleId: editing ? editing.triggerRoleId : req.query.trigger || '',
    removeRoleIds: editing ? editing.removeRoleIds : [],
    note: editing ? editing.note : '',
    active: editing ? !!editing.active : true,
  });
});

router.post('/rollenregeln/speichern', (req, res) => {
  const guild = getGuild();
  const roles = roleList(guild);
  const triggerRoleId = req.body.triggerRoleId;
  if (!triggerRoleId) {
    req.session.flash = { type: 'danger', text: 'Bitte eine auslösende Rolle wählen.' };
    return res.redirect('/rollenregeln');
  }
  const removeRoleIds = normalizeIds(req.body.removeRoleIds).filter((id) => {
    if (id === triggerRoleId) return false;
    const role = roles.find((r) => r.id === id);
    return role && !role.lockReason;
  });

  const data = { triggerRoleId, removeRoleIds, note: req.body.note || '', active: req.body.active === 'on' };
  const saved = req.body.ruleId ? repo.roleRules.update(Number(req.body.ruleId), data) : repo.roleRules.create(data);

  req.session.flash = { type: 'success', text: 'Regel gespeichert.' };
  res.redirect(`/rollenregeln?edit=${saved.id}`);
});

router.post('/rollenregeln/:id/loeschen', (req, res) => {
  repo.roleRules.delete(Number(req.params.id));
  req.session.flash = { type: 'success', text: 'Regel gelöscht.' };
  res.redirect('/rollenregeln');
});

module.exports = router;
