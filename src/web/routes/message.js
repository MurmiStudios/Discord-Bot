const express = require('express');
const repo = require('../../db/repo');
const config = require('../../config');
const { parseComposerBody, embedFieldRows, emptyComposerValues, normalizeIds } = require('../composerForm');
const { getGuild, isReady } = require('../../discord/client');
const { channelSendability, listSendableChannels } = require('../../discord/permissions');
const { buildPreviewData, buildMessagePayload } = require('../../discord/renderer');
const { bulkSendDm, describeError } = require('../../discord/send');
const { ctxForMember, ctxForUser } = require('../../discord/context');
const { sampleContext } = require('../sampleContext');

const router = express.Router();

// Alte Adressen leiten dauerhaft auf die neue Seite weiter.
router.get('/dm', (req, res) => res.redirect(301, '/nachricht?kind=dm'));
router.get('/kanaele', (req, res) => res.redirect(301, '/nachricht?kind=channel'));

async function resolveRecipientChips(ids) {
  const guild = getGuild();
  const chips = [];
  for (const id of ids) {
    let label = id;
    let missing = true;
    if (guild) {
      const member = await guild.members.fetch(id).catch(() => null);
      if (member) {
        label = member.displayName;
        missing = false;
      }
    }
    chips.push({ id, label, missing });
  }
  return chips;
}

async function resolveChannelLabel(channelId) {
  if (!channelId) return null;
  const guild = getGuild();
  if (!guild) return { id: channelId, name: channelId, missing: true };
  const channel = guild.channels.cache.get(channelId);
  if (!channel) return { id: channelId, name: channelId, missing: true };
  return { id: channelId, name: channel.name, missing: false };
}

router.get('/nachricht', async (req, res) => {
  let kind = req.query.kind === 'channel' ? 'channel' : 'dm';
  let values = emptyComposerValues();
  let draftName = '';
  let messageId = '';
  let note = '';
  let target = { recipientIds: [], channelId: null };

  if (req.query.load) {
    const saved = repo.messages.get(Number(req.query.load));
    if (saved) {
      kind = saved.kind;
      values = {
        content: saved.content,
        embedEnabled: !!saved.embed,
        embed: saved.embed,
        imageTemplateId: saved.image_template_id,
        actionBarId: saved.action_bar_id,
      };
      draftName = saved.name;
      messageId = saved.id;
      note = saved.note;
      target = saved.target || target;
    }
  }

  const recipientChips = await resolveRecipientChips(target.recipientIds || []);
  const channel = await resolveChannelLabel(target.channelId);
  const guildForChannels = getGuild();
  const channelGroups = guildForChannels ? listSendableChannels(guildForChannels) : { categories: [], uncategorized: [] };

  const preview = await buildPreviewData(
    {
      content: values.content,
      embed: values.embedEnabled ? values.embed : null,
      imageTemplate: repo.imageTemplates.get(values.imageTemplateId),
      actionBar: repo.actionBars.get(values.actionBarId),
    },
    sampleContext()
  );

  res.render('message', {
    title: 'Nachricht',
    kind,
    values,
    fieldRows: embedFieldRows(values.embed),
    imageTemplates: repo.imageTemplates.list(),
    actionBars: repo.actionBars.list(),
    draftName,
    messageId,
    note,
    recipientChips,
    channel,
    channelGroups,
    preview,
    dmMaxRecipients: config.dmMaxRecipients,
    dmDelayMs: config.dmDelayMs,
    contextLabel: kind === 'dm' ? 'Direktnachricht' : 'Kanal',
    savedMessages: repo.messages.list(),
  });
});

router.post('/nachricht/senden', async (req, res) => {
  const body = req.body || {};
  const kind = body.kind === 'channel' ? 'channel' : 'dm';
  const composed = parseComposerBody(body);
  const saveAs = (body.saveAs || '').trim();
  const recipientIds = normalizeIds(body.recipientIds);
  const channelId = body.channelId || null;
  const redirectBase = `/nachricht?kind=${kind}`;

  let savedId = body.messageId ? Number(body.messageId) : null;
  if (saveAs) {
    const data = {
      name: saveAs,
      kind,
      content: composed.content,
      embed: composed.embed,
      imageTemplateId: composed.imageTemplateId,
      actionBarId: composed.actionBarId,
      target: { recipientIds, channelId },
      note: body.note || '',
    };
    const saved = savedId ? repo.messages.update(savedId, data) : repo.messages.create(data);
    savedId = saved.id;
  }

  if (body.action === 'save') {
    if (!saveAs) {
      req.session.flash = { type: 'danger', text: 'Bitte zuerst einen Namen für die Ablage eintragen.' };
      return res.redirect(redirectBase);
    }
    req.session.flash = { type: 'success', text: `„${saveAs}“ gespeichert.` };
    return res.redirect(`/nachricht?kind=${kind}&load=${savedId}`);
  }

  if (!isReady() || !getGuild()) {
    req.session.flash = { type: 'danger', text: 'Der Bot ist nicht verbunden. Die Nachricht konnte nicht gesendet werden.' };
    return res.redirect(redirectBase);
  }
  const guild = getGuild();

  if (kind === 'channel') {
    if (!channelId) {
      req.session.flash = { type: 'danger', text: 'Bitte einen Kanal wählen.' };
      return res.redirect(redirectBase);
    }
    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      req.session.flash = { type: 'danger', text: 'Dieser Kanal existiert nicht mehr.' };
      return res.redirect(redirectBase);
    }
    const { can, reason } = channelSendability(channel);
    if (!can) {
      req.session.flash = { type: 'danger', text: `Nachricht kann nicht gesendet werden: ${reason}` };
      return res.redirect(redirectBase);
    }
    try {
      const ctx = { userName: '', userTag: '', guildName: guild.name, memberCount: guild.memberCount, roleName: '', avatarUrl: null };
      const payload = await buildMessagePayload(
        { content: composed.content, embed: composed.embed, imageTemplate: repo.imageTemplates.get(composed.imageTemplateId), actionBar: repo.actionBars.get(composed.actionBarId) },
        ctx
      );
      await channel.send(payload);
      repo.audit.log({ kind: 'nachricht', actorId: req.session.user.id, actorTag: req.session.user.username, summary: `Nachricht in #${channel.name} gesendet`, success: true });
      req.session.flash = { type: 'success', text: `Gesendet in #${channel.name}.` };
    } catch (err) {
      repo.audit.log({ kind: 'nachricht', actorId: req.session.user.id, actorTag: req.session.user.username, summary: `Nachricht in #${channel.name} fehlgeschlagen`, success: false, reason: describeError(err) });
      req.session.flash = { type: 'danger', text: `Senden fehlgeschlagen: ${describeError(err)}` };
    }
    return res.redirect(redirectBase);
  }

  // kind === 'dm'
  if (recipientIds.length === 0) {
    req.session.flash = { type: 'danger', text: 'Bitte mindestens einen Empfänger wählen.' };
    return res.redirect(redirectBase);
  }
  if (recipientIds.length > config.dmMaxRecipients) {
    req.session.flash = { type: 'danger', text: `Höchstens ${config.dmMaxRecipients} Empfänger je Versand.` };
    return res.redirect(redirectBase);
  }

  const users = [];
  for (const id of recipientIds) {
    const u = await guild.client.users.fetch(id).catch(() => null);
    if (u) users.push(u);
  }
  const imageTemplate = repo.imageTemplates.get(composed.imageTemplateId);
  const actionBar = repo.actionBars.get(composed.actionBarId);

  const result = await bulkSendDm(
    users,
    async (user) => {
      const member = await guild.members.fetch(user.id).catch(() => null);
      const ctx = member ? ctxForMember(member, guild) : ctxForUser(user, guild);
      return buildMessagePayload({ content: composed.content, embed: composed.embed, imageTemplate, actionBar }, ctx);
    },
    { actorId: req.session.user.id, actorTag: req.session.user.username, logSummary: 'Nachricht' }
  );

  req.session.flash = {
    type: result.failed ? 'warning' : 'success',
    text: `${result.sent} zugestellt, ${result.failed} fehlgeschlagen.${result.failed ? ' Details im Protokoll.' : ''}`,
  };
  res.redirect(redirectBase);
});

module.exports = router;
