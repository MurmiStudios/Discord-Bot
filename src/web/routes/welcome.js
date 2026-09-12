const express = require('express');
const repo = require('../../db/repo');
const { parseComposerBody, embedFieldRows } = require('../composerForm');
const { buildPreviewData, buildMessagePayload } = require('../../discord/renderer');
const { sampleContext } = require('../sampleContext');
const { getGuild, isReady } = require('../../discord/client');
const { sendDm, describeError } = require('../../discord/send');
const { ctxForMember, ctxForUser } = require('../../discord/context');

const router = express.Router();

router.get('/willkommen', async (req, res) => {
  const welcome = repo.welcome.get();
  const values = {
    content: welcome.content,
    embedEnabled: !!welcome.embed,
    embed: welcome.embed,
    imageTemplateId: welcome.image_template_id,
    actionBarId: welcome.action_bar_id,
  };

  const preview = await buildPreviewData(
    {
      content: values.content,
      embed: values.embedEnabled ? values.embed : null,
      imageTemplate: repo.imageTemplates.get(values.imageTemplateId),
      actionBar: repo.actionBars.get(values.actionBarId),
    },
    sampleContext()
  );

  res.render('welcome', {
    title: 'Willkommen',
    values,
    active: !!welcome.active,
    fieldRows: embedFieldRows(values.embed),
    imageTemplates: repo.imageTemplates.list(),
    actionBars: repo.actionBars.list(),
    preview,
    contextLabel: 'Direktnachricht bei Serverbeitritt',
  });
});

router.post('/willkommen/speichern', (req, res) => {
  const composed = parseComposerBody(req.body);
  const active = req.body.active === 'on';

  if (active && !composed.content && !composed.embed && !composed.imageTemplateId) {
    req.session.flash = { type: 'danger', text: 'Aktiv ohne Text, Embed und Bild wäre eine Willkommensnachricht, die nichts sagt.' };
    return res.redirect('/willkommen');
  }

  repo.welcome.save({ ...composed, active });
  req.session.flash = { type: 'success', text: 'Willkommensnachricht gespeichert.' };
  res.redirect('/willkommen');
});

router.post('/willkommen/test', async (req, res) => {
  const welcome = repo.welcome.get();
  const guild = getGuild();
  if (!isReady() || !guild) {
    req.session.flash = { type: 'danger', text: 'Bot ist nicht verbunden.' };
    return res.redirect('/willkommen');
  }
  try {
    const member = await guild.members.fetch(req.session.user.id).catch(() => null);
    const ctx = member ? ctxForMember(member, guild) : ctxForUser({ id: req.session.user.id, tag: req.session.user.username, username: req.session.user.username, displayAvatarURL: () => null }, guild);
    const payload = await buildMessagePayload(
      { content: welcome.content, embed: welcome.embed, imageTemplate: repo.imageTemplates.get(welcome.image_template_id), actionBar: repo.actionBars.get(welcome.action_bar_id) },
      ctx
    );
    const user = await guild.client.users.fetch(req.session.user.id);
    await sendDm(user, payload);
    req.session.flash = { type: 'success', text: 'Test-DM an dich gesendet.' };
  } catch (err) {
    req.session.flash = { type: 'danger', text: `Test-DM fehlgeschlagen: ${describeError(err)}` };
  }
  res.redirect('/willkommen');
});

module.exports = router;
