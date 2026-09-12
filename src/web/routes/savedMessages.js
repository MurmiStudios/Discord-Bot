const express = require('express');
const repo = require('../../db/repo');
const { getGuild } = require('../../discord/client');

const router = express.Router();

router.get('/nachrichten', (req, res) => {
  const filter = ['dm', 'channel'].includes(req.query.filter) ? req.query.filter : 'alle';
  const all = repo.messages.list();
  const guild = getGuild();

  const items = all
    .filter((m) => filter === 'alle' || m.kind === filter)
    .map((m) => {
      let targetLabel = m.kind === 'dm' ? `${(m.target && m.target.recipientIds || []).length} Empfänger` : 'Kein Kanal gewählt';
      let missing = false;
      if (m.kind === 'channel' && m.target && m.target.channelId) {
        if (guild) {
          const ch = guild.channels.cache.get(m.target.channelId);
          targetLabel = ch ? `#${ch.name}` : 'Kanal gelöscht';
          missing = !ch;
        } else {
          targetLabel = 'Kanal (Bot nicht verbunden)';
        }
      }
      return { ...m, targetLabel, missing };
    });

  res.render('savedMessages', {
    title: 'Gespeicherte Nachrichten',
    filter,
    items,
    counts: { alle: all.length, dm: all.filter((m) => m.kind === 'dm').length, channel: all.filter((m) => m.kind === 'channel').length },
  });
});

router.post('/nachrichten/:id/loeschen', (req, res) => {
  repo.messages.delete(Number(req.params.id));
  req.session.flash = { type: 'success', text: 'Nachricht gelöscht.' };
  res.redirect('/nachrichten');
});

router.post('/nachrichten/:id/kopieren', (req, res) => {
  const original = repo.messages.get(Number(req.params.id));
  if (!original) return res.redirect('/nachrichten');
  const copy = repo.messages.create({
    name: `${original.name} (Kopie)`,
    kind: original.kind,
    content: original.content,
    embed: original.embed,
    imageTemplateId: original.image_template_id,
    actionBarId: original.action_bar_id,
    target: original.target,
    note: original.note,
  });
  res.redirect(`/nachricht?kind=${copy.kind}&load=${copy.id}`);
});

router.post('/nachrichten/:id/aktualisieren', (req, res) => {
  const existing = repo.messages.get(Number(req.params.id));
  if (!existing) return res.redirect('/nachrichten');
  repo.messages.update(existing.id, {
    name: req.body.name || existing.name,
    kind: req.body.kind === 'channel' ? 'channel' : 'dm',
    content: existing.content,
    embed: existing.embed,
    imageTemplateId: existing.image_template_id,
    actionBarId: existing.action_bar_id,
    target: existing.target,
    note: req.body.note || '',
  });
  req.session.flash = { type: 'success', text: 'Aktualisiert.' };
  res.redirect('/nachrichten');
});

module.exports = router;
