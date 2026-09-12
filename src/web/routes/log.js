const express = require('express');
const repo = require('../../db/repo');

const router = express.Router();

function groupByDay(rows) {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const groups = [];
  let currentKey = null;
  let currentGroup = null;

  for (const row of rows) {
    const d = new Date(row.created_at + 'Z');
    const key = d.toDateString();
    let label;
    if (key === today) label = 'Heute';
    else if (key === yesterday) label = 'Gestern';
    else label = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    if (key !== currentKey) {
      currentGroup = { label, entries: [] };
      groups.push(currentGroup);
      currentKey = key;
    }
    currentGroup.entries.push(row);
  }
  return groups;
}

router.get('/protokoll', (req, res) => {
  const kind = ['nachricht', 'rolle', 'anmeldung', 'fehler'].includes(req.query.kind) ? req.query.kind : 'alle';
  const search = (req.query.q || '').trim();
  const page = Math.max(1, Number(req.query.page) || 1);

  const result = repo.audit.list({ kind, search, page, pageSize: 50 });
  const counts = repo.audit.counts();

  res.render('log', {
    title: 'Protokoll',
    kind,
    search,
    page,
    totalPages: Math.max(1, Math.ceil(result.total / result.pageSize)),
    counts,
    groups: groupByDay(result.rows),
  });
});

module.exports = router;
