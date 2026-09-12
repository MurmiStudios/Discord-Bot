const express = require('express');
const repo = require('../../db/repo');

const router = express.Router();

function csvEscape(v) {
  const s = String(v == null ? '' : v).replace(/"/g, '""');
  return `"${s}"`;
}

router.get('/rueckmeldungen', (req, res) => {
  const bars = repo.actionBars.list();
  const filterBarId = req.query.bar ? Number(req.query.bar) : null;
  const items = repo.feedback.list({ actionBarId: filterBarId });

  res.render('feedback', {
    title: 'Rückmeldungen',
    bars,
    filterBarId,
    items,
  });
});

router.get('/rueckmeldungen.csv', (req, res) => {
  const filterBarId = req.query.bar ? Number(req.query.bar) : null;
  const items = repo.feedback.list({ actionBarId: filterBarId });
  const rows = [['Zeitpunkt', 'Person', 'Button', 'Frage', 'Antwort'].map(csvEscape).join(',')];
  items.forEach((r) => {
    r.answers.forEach((a) => {
      rows.push([r.submitted_at, r.user_tag, r.button_label, a.question, a.answer].map(csvEscape).join(','));
    });
  });
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="rueckmeldungen.csv"');
  res.send('﻿' + rows.join('\r\n'));
});

router.post('/rueckmeldungen/:id/loeschen', (req, res) => {
  repo.feedback.delete(Number(req.params.id));
  req.session.flash = { type: 'success', text: 'Rückmeldung gelöscht.' };
  res.redirect(req.query.back || '/rueckmeldungen');
});

module.exports = router;
