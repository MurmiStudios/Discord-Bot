const repo = require('../../db/repo');
const { buildMessagePayload } = require('../renderer');
const { ctxForMember } = require('../context');
const { sendDm, describeError } = require('../send');
const { canBotManageRole } = require('../permissions');

module.exports = function register(client) {
  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const addedRoleIds = [...newMember.roles.cache.keys()].filter((id) => !oldMember.roles.cache.has(id));
    if (addedRoleIds.length === 0) return;

    for (const roleId of addedRoleIds) {
      await handleRoleMessage(newMember, roleId).catch(() => {});
      await handleRoleRules(newMember, roleId).catch(() => {});
    }
  });
};

async function handleRoleMessage(member, roleId) {
  const rm = repo.roleMessages.getByRole(roleId);
  if (!rm || !rm.active) return;
  const role = member.guild.roles.cache.get(roleId);
  const ctx = ctxForMember(member, member.guild, { roleName: role ? role.name : '' });
  try {
    const payload = await buildMessagePayload(
      {
        content: rm.content,
        embed: rm.embed,
        imageTemplate: repo.imageTemplates.get(rm.image_template_id),
        actionBar: repo.actionBars.get(rm.action_bar_id),
      },
      ctx
    );
    await sendDm(member.user, payload);
    repo.audit.log({ kind: 'nachricht', summary: `Rollen-DM „${role ? role.name : roleId}“ an ${member.user.tag}`, success: true });
  } catch (err) {
    repo.audit.log({
      kind: 'nachricht',
      summary: `Rollen-DM „${role ? role.name : roleId}“ an ${member.user.tag} nicht zugestellt`,
      success: false,
      reason: describeError(err),
    });
  }
}

// Prueft die Rollenregeln erneut zur Laufzeit -- eine Rolle kann seit dem
// Speichern im Panel verschoben oder von einer Integration uebernommen worden sein.
async function handleRoleRules(member, roleId) {
  const rules = repo.roleRules.listActive().filter((r) => r.triggerRoleId === roleId);
  if (rules.length === 0) return;
  const guild = member.guild;

  for (const rule of rules) {
    const toRemove = rule.removeRoleIds.filter((id) => id !== roleId && member.roles.cache.has(id));
    for (const removeId of toRemove) {
      const role = guild.roles.cache.get(removeId);
      if (!role) continue;
      if (!canBotManageRole(guild, role)) {
        repo.audit.log({
          kind: 'rolle',
          summary: `Regel konnte „${role.name}“ bei ${member.user.tag} nicht entfernen`,
          success: false,
          reason: 'Rolle steht über der Bot-Rolle oder wird von einer Integration verwaltet',
        });
        continue;
      }
      try {
        await member.roles.remove(removeId, `Rollenregel: Erhalt von ${roleId}`);
        repo.audit.log({
          kind: 'rolle',
          summary: `„${role.name}“ bei ${member.user.tag} entfernt (Rollenregel)`,
          success: true,
        });
      } catch (err) {
        repo.audit.log({
          kind: 'rolle',
          summary: `„${role.name}“ bei ${member.user.tag} konnte nicht entfernt werden`,
          success: false,
          reason: err.message,
        });
      }
    }
  }
}
