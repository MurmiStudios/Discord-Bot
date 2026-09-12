const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, UserSelectMenuBuilder } = require('discord.js');
const repo = require('../../db/repo');
const { buildMessagePayload } = require('../renderer');
const { ctxForMember, ctxForUser } = require('../context');
const { sendDm, describeError } = require('../send');
const { canBotManageRole, canBotKick } = require('../permissions');
const placeholders = require('../placeholders');

module.exports = function register(client) {
  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isButton() && interaction.customId.startsWith('ab:')) {
        await handleButtonClick(interaction);
      } else if (interaction.isUserSelectMenu() && interaction.customId.startsWith('ab-pick:')) {
        await handleUserPicked(interaction);
      } else if (interaction.isModalSubmit() && interaction.customId.startsWith('fb:')) {
        await handleModalSubmit(interaction);
      }
    } catch (err) {
      console.error('[interaction]', err);
      repo.audit.log({ kind: 'fehler', summary: 'Interaktion fehlgeschlagen', success: false, reason: err.message });
    }
  });
};

async function handleButtonClick(interaction) {
  const [, actionBarId, buttonId] = interaction.customId.split(':');
  const bar = repo.actionBars.get(Number(actionBarId));
  if (!bar) return interaction.reply({ content: 'Diese Aktionsleiste gibt es nicht mehr.', ephemeral: true });

  const button = bar.buttons.find((b) => b.id === buttonId);
  if (!button) return interaction.reply({ content: 'Dieser Button ist nicht mehr eingerichtet.', ephemeral: true });

  if (button.allowedRoleIds && button.allowedRoleIds.length) {
    const allowed = button.allowedRoleIds.some((id) => interaction.member.roles.cache.has(id));
    if (!allowed) return interaction.reply({ content: 'Dieser Button ist nicht für dich freigegeben.', ephemeral: true });
  }

  if (bar.once_per_member) {
    if (repo.buttonClicks.hasClicked(bar.id, buttonId, interaction.user.id)) {
      return interaction.reply({ content: 'Du hast bereits geklickt.', ephemeral: true });
    }
    repo.buttonClicks.record(bar.id, buttonId, interaction.user.id);
  }

  const state = {
    interaction,
    guild: interaction.guild,
    member: interaction.member,
    clickerUser: interaction.user,
    feedback: '',
    actionBarId: bar.id,
    buttonId,
    replyText: button.replyText || '',
    ephemeralReply: !!bar.ephemeral_reply,
    responded: false,
  };
  await runActionsFrom(button.actions || [], 0, state);
}

async function handleUserPicked(interaction) {
  const [, actionBarId, buttonId, actionIndexStr] = interaction.customId.split(':');
  const bar = repo.actionBars.get(Number(actionBarId));
  const button = bar && bar.buttons.find((b) => b.id === buttonId);
  if (!bar || !button) return interaction.update({ content: 'Nicht mehr verfügbar.', components: [] });

  const action = (button.actions || [])[Number(actionIndexStr)];
  const target = interaction.users.first();
  if (action.restrictRoleId) {
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member || !member.roles.cache.has(action.restrictRoleId)) {
      return interaction.update({ content: 'Diese Person hat nicht die passende Rolle.', components: [] });
    }
  }

  await interaction.update({ content: `Ausgewählt: ${target.tag}`, components: [] });

  const state = {
    interaction,
    guild: interaction.guild,
    member: interaction.member,
    clickerUser: interaction.user,
    feedback: '',
    actionBarId: bar.id,
    buttonId,
    replyText: button.replyText || '',
    ephemeralReply: !!bar.ephemeral_reply,
    responded: true, // interaction.update() hat bereits geantwortet
  };
  await runActionsFrom(button.actions || [], Number(actionIndexStr), state, target);
}

async function handleModalSubmit(interaction) {
  const [, actionBarId, buttonId, resumeIndexStr] = interaction.customId.split(':');
  const bar = repo.actionBars.get(Number(actionBarId));
  const button = bar && bar.buttons.find((b) => b.id === buttonId);
  if (!bar || !button) return interaction.reply({ content: 'Nicht mehr verfügbar.', ephemeral: true });

  const resumeIndex = Number(resumeIndexStr);
  const action = (button.actions || [])[resumeIndex];
  const answers = (action.fields || []).map((f, i) => ({
    question: f.label,
    answer: interaction.fields.getTextInputValue(`f${i}`),
  }));

  repo.feedback.create({
    actionBarId: bar.id,
    buttonId,
    buttonLabel: button.label,
    userId: interaction.user.id,
    userTag: interaction.user.tag,
    answers,
  });
  repo.audit.log({ kind: 'nachricht', summary: `Rückmeldung von ${interaction.user.tag} auf „${button.label}“`, success: true });

  const state = {
    interaction,
    guild: interaction.guild,
    member: interaction.member,
    clickerUser: interaction.user,
    feedback: answers.map((a) => a.answer).join(' | '),
    actionBarId: bar.id,
    buttonId,
    replyText: button.replyText || '',
    ephemeralReply: !!bar.ephemeral_reply,
    responded: false,
  };
  await runActionsFrom(button.actions || [], resumeIndex + 1, state);
}

// Fuehrt die Aktionskette eines Buttons ab startIndex aus. Bleibt bei einem
// Rueckmeldungsfenster oder einer Personenauswahl stehen -- der Rest laeuft
// erst weiter, wenn Discord die entsprechende Antwort schickt.
async function runActionsFrom(actions, startIndex, state, pickedUser) {
  for (let i = startIndex; i < actions.length; i++) {
    const action = actions[i];

    if (action.type === 'feedback_modal') {
      const modal = new ModalBuilder().setCustomId(`fb:${state.actionBarId}:${state.buttonId}:${i}`).setTitle(action.title || 'Rückmeldung');
      const fields = (action.fields || []).slice(0, 5);
      for (let f = 0; f < fields.length; f++) {
        const input = new TextInputBuilder()
          .setCustomId(`f${f}`)
          .setLabel(fields[f].label.slice(0, 45))
          .setStyle(fields[f].style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
          .setRequired(!!fields[f].required);
        if (fields[f].placeholder) input.setPlaceholder(fields[f].placeholder.slice(0, 100));
        modal.addComponents(new ActionRowBuilder().addComponents(input));
      }
      await state.interaction.showModal(modal);
      return; // Rest der Kette laeuft in handleModalSubmit weiter
    }

    if (action.type === 'dm_fixed' && action.targetMode === 'pick' && !pickedUser) {
      const row = new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder().setCustomId(`ab-pick:${state.actionBarId}:${state.buttonId}:${i}`).setPlaceholder('Person auswählen').setMinValues(1).setMaxValues(1)
      );
      const payload = { content: 'Wen soll die Nachricht erreichen?', components: [row], ephemeral: true };
      if (state.responded) await state.interaction.followUp(payload);
      else {
        await state.interaction.reply(payload);
        state.responded = true;
      }
      return; // Rest der Kette laeuft in handleUserPicked weiter
    }

    await runSingleAction(action, state, pickedUser);
  }

  if (state.ephemeralReply && state.replyText) {
    const text = placeholders.apply(state.replyText, {
      userName: state.clickerUser.username,
      userTag: state.clickerUser.tag,
      guildName: state.guild.name,
      feedback: state.feedback,
    });
    if (state.responded) await state.interaction.followUp({ content: text, ephemeral: true });
    else await state.interaction.reply({ content: text, ephemeral: true });
  } else if (!state.responded && state.interaction.isRepliable()) {
    await state.interaction.deferUpdate().catch(() => {});
  }
}

async function runSingleAction(action, state, pickedUser) {
  const guild = state.guild;

  if (action.type === 'dm_clicker' || action.type === 'dm_fixed') {
    let targetUser;
    if (action.type === 'dm_clicker') targetUser = state.clickerUser;
    else if (action.targetMode === 'pick') targetUser = pickedUser;
    else targetUser = await guild.client.users.fetch(action.targetUserId).catch(() => null);
    if (!targetUser) return;

    const ctx = ctxForUser(targetUser, guild, { clickerName: state.clickerUser.username, clickerTag: state.clickerUser.tag, feedback: state.feedback });
    try {
      const payload = await buildMessagePayload(
        { content: action.content, embed: action.embed, imageTemplate: repo.imageTemplates.get(action.imageTemplateId), actionBar: repo.actionBars.get(action.actionBarId) },
        ctx
      );
      await sendDm(targetUser, payload);
      repo.audit.log({ kind: 'nachricht', actorId: state.clickerUser.id, actorTag: state.clickerUser.tag, summary: `Button-DM an ${targetUser.tag}`, success: true });
    } catch (err) {
      repo.audit.log({
        kind: 'nachricht',
        actorId: state.clickerUser.id,
        actorTag: state.clickerUser.tag,
        summary: `Button-DM an ${targetUser.tag} nicht zugestellt`,
        success: false,
        reason: describeError(err),
      });
    }
    return;
  }

  if (['role_add', 'role_remove', 'role_toggle'].includes(action.type)) {
    const role = guild.roles.cache.get(action.roleId);
    if (!role || !canBotManageRole(guild, role)) {
      repo.audit.log({ kind: 'rolle', actorId: state.clickerUser.id, actorTag: state.clickerUser.tag, summary: `Rolle „${role ? role.name : action.roleId}“ konnte nicht vergeben werden`, success: false, reason: 'Bot kann diese Rolle nicht verwalten' });
      return;
    }
    const has = state.member.roles.cache.has(role.id);
    const shouldAdd = action.type === 'role_add' || (action.type === 'role_toggle' && !has);
    const shouldRemove = action.type === 'role_remove' || (action.type === 'role_toggle' && has);
    try {
      if (shouldAdd) await state.member.roles.add(role.id, 'Button-Aktion');
      if (shouldRemove) await state.member.roles.remove(role.id, 'Button-Aktion');
      repo.audit.log({ kind: 'rolle', actorId: state.clickerUser.id, actorTag: state.clickerUser.tag, summary: `„${role.name}“ ${shouldAdd ? 'vergeben' : 'entfernt'} bei ${state.clickerUser.tag}`, success: true });
    } catch (err) {
      repo.audit.log({ kind: 'rolle', actorId: state.clickerUser.id, actorTag: state.clickerUser.tag, summary: `„${role.name}“ bei ${state.clickerUser.tag} fehlgeschlagen`, success: false, reason: err.message });
    }
    return;
  }

  if (action.type === 'kick') {
    if (action.escapeRoleId && state.member.roles.cache.has(action.escapeRoleId)) {
      repo.audit.log({ kind: 'rolle', actorId: state.clickerUser.id, actorTag: state.clickerUser.tag, summary: `${state.clickerUser.tag} nicht gekickt (hat Ausweg-Rolle)`, success: true });
      return;
    }
    const check = canBotKick(guild, state.member);
    if (!check.can) {
      repo.audit.log({ kind: 'rolle', actorId: state.clickerUser.id, actorTag: state.clickerUser.tag, summary: `${state.clickerUser.tag} konnte nicht gekickt werden`, success: false, reason: check.reason });
      return;
    }
    try {
      await state.member.kick(action.reason || 'Button-Aktion');
      repo.audit.log({ kind: 'rolle', actorId: state.clickerUser.id, actorTag: state.clickerUser.tag, summary: `${state.clickerUser.tag} gekickt`, success: true });
    } catch (err) {
      repo.audit.log({ kind: 'rolle', actorId: state.clickerUser.id, actorTag: state.clickerUser.tag, summary: `${state.clickerUser.tag} konnte nicht gekickt werden`, success: false, reason: err.message });
    }
  }
}
