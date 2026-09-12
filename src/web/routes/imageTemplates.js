const express = require('express');
const repo = require('../../db/repo');
const { renderImageTemplate } = require('../../discord/imageRenderer');
const { sampleContext } = require('../sampleContext');
const { getGuild, isReady } = require('../../discord/client');

const router = express.Router();
const MAX_LINES = 4;

const PRESETS = {
  breit: { width: 1200, height: 600 },
  quadratisch: { width: 800, height: 800 },
  banner: { width: 1920, height: 480 },
};

function parseTemplateBody(body) {
  const preset = body.preset || 'eigen';
  const width = preset === 'eigen' ? Number(body.width) || 1200 : PRESETS[preset].width;
  const height = preset === 'eigen' ? Number(body.height) || 500 : PRESETS[preset].height;

  const rawLines = body.lines || {};
  const lines = Object.keys(rawLines)
    .sort()
    .map((k) => rawLines[k])
    .filter((l) => l && l.text && l.text.trim())
    .slice(0, MAX_LINES)
    .map((l) => ({
      text: l.text.trim(),
      size: Number(l.size) || 32,
      color: l.color || '#ffffff',
      align: ['left', 'center', 'right'].includes(l.align) ? l.align : 'left',
      maxWidth: Number(l.maxWidth) || width - 160,
      shadow: l.shadow === 'on',
      x: l.x !== '' && l.x != null ? Number(l.x) : null,
      y: l.y !== '' && l.y != null ? Number(l.y) : null,
    }));

  return {
    name: (body.name || '').trim(),
    preset,
    width,
    height,
    bgType: body.bgType === 'image' ? 'image' : 'color',
    bgColor: body.bgColor || '#5865f2',
    bgImagePath: body.bgImagePath || null,
    bgDim: Math.min(Math.max(Number(body.bgDim) || 0, 0), 1),
    avatar: {
      enabled: body.avatarEnabled === 'on',
      shape: ['round', 'rounded', 'square'].includes(body.avatarShape) ? body.avatarShape : 'round',
      x: Number(body.avatarX) || 80,
      y: body.avatarY !== '' && body.avatarY != null ? Number(body.avatarY) : height - (Number(body.avatarSize) || 90) - 80,
      size: Number(body.avatarSize) || 90,
      border: Number(body.avatarBorder) || 0,
    },
    lines,
    align: ['left', 'center', 'right'].includes(body.align) ? body.align : 'left',
  };
}

router.get('/vorlagen', async (req, res) => {
  let editing = null;
  if (req.query.edit) editing = repo.imageTemplates.get(Number(req.query.edit));

  const values = editing
    ? editing
    : {
        name: '',
        preset: 'eigen',
        width: 1200,
        height: 500,
        bg_type: 'color',
        bg_color: '#5865f2',
        bg_image_path: null,
        bg_dim: 0,
        avatar: { enabled: true, shape: 'round', x: 80, y: 330, size: 90, border: 0 },
        lines: [],
        align: 'left',
      };
  const lineRows = values.lines.slice(0, MAX_LINES);
  while (lineRows.length < MAX_LINES) lineRows.push({ text: '', size: 32, color: '#ffffff', align: 'left', maxWidth: '', shadow: false, x: '', y: '' });

  let previewDataUrl = null;
  try {
    const png = await renderImageTemplate(
      { width: values.width, height: values.height, bg_type: values.bg_type || values.bgType, bg_color: values.bg_color || values.bgColor, bg_image_path: values.bg_image_path, bg_dim: values.bg_dim, avatar_json: values.avatar, lines_json: values.lines, align: values.align },
      sampleContext()
    );
    previewDataUrl = `data:image/png;base64,${png.toString('base64')}`;
  } catch (err) {
    console.error('[vorlagen preview]', err);
  }

  res.render('imageTemplates', {
    title: 'Bildvorlagen',
    templates: repo.imageTemplates.list(),
    editing,
    values,
    lineRows,
    previewDataUrl,
    maxLines: MAX_LINES,
    botOnline: isReady(),
  });
});

router.post('/vorlagen/speichern', (req, res) => {
  const data = parseTemplateBody(req.body);
  if (!data.name) {
    req.session.flash = { type: 'danger', text: 'Bitte einen Namen eintragen.' };
    return res.redirect('/vorlagen');
  }
  const saved = req.body.templateId ? repo.imageTemplates.update(Number(req.body.templateId), data) : repo.imageTemplates.create(data);
  req.session.flash = { type: 'success', text: 'Bildvorlage gespeichert.' };
  res.redirect(`/vorlagen?edit=${saved.id}`);
});

router.post('/vorlagen/:id/loeschen', (req, res) => {
  const id = Number(req.params.id);
  if (repo.imageTemplates.usedByAny(id)) {
    req.session.flash = { type: 'danger', text: 'Diese Vorlage wird noch von einer Nachricht verwendet und kann nicht gelöscht werden.' };
    return res.redirect('/vorlagen');
  }
  repo.imageTemplates.delete(id);
  req.session.flash = { type: 'success', text: 'Bildvorlage gelöscht.' };
  res.redirect('/vorlagen');
});

router.get('/vorlagen/:id/vorschau-mitglied', async (req, res) => {
  const template = repo.imageTemplates.get(Number(req.params.id));
  const guild = getGuild();
  if (!template) return res.status(404).end();
  let ctx = sampleContext();
  if (guild && req.query.userId) {
    const member = await guild.members.fetch(req.query.userId).catch(() => null);
    if (member) ctx = { userName: member.displayName, userTag: member.user.tag, guildName: guild.name, memberCount: guild.memberCount, avatarUrl: member.displayAvatarURL({ extension: 'png', size: 256 }) };
  }
  const png = await renderImageTemplate(template, ctx);
  res.set('Content-Type', 'image/png');
  res.send(png);
});

module.exports = router;
