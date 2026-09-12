const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const config = require('../../config');
const repo = require('../../db/repo');
const { getGuild, isReady } = require('../../discord/client');
const { listSendableChannels } = require('../../discord/permissions');
const { buildPreviewData } = require('../../discord/renderer');
const { renderImageTemplate } = require('../../discord/imageRenderer');
const { sampleContext, RAW_CONTEXT } = require('../sampleContext');
const { bulkSendDm } = require('../../discord/send');
const { ctxForMember, ctxForUser } = require('../../discord/context');
const rateLimit = require('../middleware/rateLimit');

const router = express.Router();

router.get('/search', async (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  const guild = getGuild();
  if (!guild) return res.json({ results: [], botOnline: false });

  try {
    const members = q ? await guild.members.fetch({ query: q, limit: 15 }) : new Map();
    const memberResults = [...members.values()].map((m) => ({
      id: m.id,
      type: 'member',
      label: m.displayName,
      sublabel: `@${m.user.username}`,
    }));

    const roles = [...guild.roles.cache.values()]
      .filter((r) => r.id !== guild.id && r.name.toLowerCase().includes(q))
      .slice(0, 10)
      .map((r) => ({ id: r.id, type: 'role', label: r.name, sublabel: `${r.members.size} Mitglieder` }));

    res.json({ results: [...roles, ...memberResults], botOnline: true });
  } catch (err) {
    res.json({ results: [], botOnline: true, error: err.message });
  }
});

router.get('/channels', async (req, res) => {
  const guild = getGuild();
  if (!guild) return res.json({ categories: [], uncategorized: [], botOnline: false });
  res.json({ ...listSendableChannels(guild), botOnline: true });
});

router.get('/role-members/:roleId', async (req, res) => {
  const guild = getGuild();
  if (!guild) return res.json({ results: [] });
  try {
    await guild.members.fetch();
    const role = guild.roles.cache.get(req.params.roleId);
    if (!role) return res.json({ results: [] });
    res.json({ results: [...role.members.values()].map((m) => ({ id: m.id, label: m.displayName })) });
  } catch (err) {
    res.status(500).json({ results: [], error: err.message });
  }
});

router.post('/preview', rateLimit.preview, async (req, res) => {
  const body = req.body || {};
  const mode = body.mode === 'raw' ? 'raw' : 'sample';
  const ctx = mode === 'raw' ? { ...RAW_CONTEXT } : sampleContext({ roleName: body.roleName || undefined });

  try {
    const preview = await buildPreviewData(
      {
        content: body.content || '',
        embed: body.embedEnabled ? body.embed : null,
        imageTemplate: body.imageTemplateId ? repo.imageTemplates.get(Number(body.imageTemplateId)) : null,
        actionBar: body.actionBarId ? repo.actionBars.get(Number(body.actionBarId)) : null,
      },
      ctx
    );
    res.render('partials/discordPreview', { contextLabel: body.contextLabel || 'Vorschau', preview }, (err, html) => {
      if (err) {
        console.error('[preview]', err);
        return res.status(500).json({ error: 'Vorschau fehlgeschlagen' });
      }
      res.send(html);
    });
  } catch (err) {
    console.error('[preview]', err);
    res.status(500).json({ error: 'Vorschau fehlgeschlagen' });
  }
});

router.post('/preview-template', rateLimit.preview, async (req, res) => {
  try {
    const png = await renderImageTemplate(req.body, sampleContext());
    res.set('Content-Type', 'image/png');
    res.send(png);
  } catch (err) {
    console.error('[preview-template]', err);
    res.status(500).json({ error: 'Vorschau fehlgeschlagen' });
  }
});

// ---- Bild-Upload (Hintergrund fuer Bildvorlagen) ----
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const ok = ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('Nur PNG, JPEG oder WebP erlaubt'), ok);
  },
});

router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Keine Datei erhalten' });
  const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[req.file.mimetype];
  const name = `${crypto.randomBytes(12).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(config.dataDir, 'uploads', name), req.file.buffer);
  res.json({ path: name, url: `/uploads/${name}` });
});

router.use((err, req, res, next) => {
  if (err) return res.status(400).json({ error: err.message });
  next();
});

// ---- Massenversand mit Fortschritt (Server-Sent Events) ----
const jobs = new Map();

router.post('/send-dm', rateLimit.send, async (req, res) => {
  const { recipientIds, message, actorId, actorTag, logSummary } = req.body || {};
  const guild = getGuild();
  if (!isReady() || !guild) return res.status(503).json({ error: 'Bot ist nicht verbunden' });
  if (!Array.isArray(recipientIds) || recipientIds.length === 0) return res.status(400).json({ error: 'Keine Empfänger' });
  if (recipientIds.length > config.dmMaxRecipients) {
    return res.status(400).json({ error: `Höchstens ${config.dmMaxRecipients} Empfänger je Versand` });
  }

  const jobId = crypto.randomBytes(8).toString('hex');
  jobs.set(jobId, { sent: 0, failed: 0, failures: [], total: recipientIds.length, done: false });

  (async () => {
    const users = [];
    for (const id of recipientIds) {
      const u = await guild.client.users.fetch(id).catch(() => null);
      if (u) users.push(u);
    }
    const imageTemplate = message.imageTemplateId ? repo.imageTemplates.get(Number(message.imageTemplateId)) : null;
    const actionBar = message.actionBarId ? repo.actionBars.get(Number(message.actionBarId)) : null;
    const { buildMessagePayload } = require('../../discord/renderer');

    await bulkSendDm(
      users,
      async (user) => {
        const member = await guild.members.fetch(user.id).catch(() => null);
        const ctx = member ? ctxForMember(member, guild) : ctxForUser(user, guild);
        return buildMessagePayload({ content: message.content, embed: message.embedEnabled ? message.embed : null, imageTemplate, actionBar }, ctx);
      },
      {
        actorId,
        actorTag,
        logSummary: logSummary || 'Nachricht',
        onProgress(p) {
          jobs.set(jobId, { ...p, done: p.index >= p.total });
        },
      }
    );
    const final = jobs.get(jobId);
    jobs.set(jobId, { ...final, done: true });
    setTimeout(() => jobs.delete(jobId), 5 * 60 * 1000);
  })();

  res.json({ jobId });
});

router.get('/send-dm/:jobId/stream', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();

  const timer = setInterval(() => {
    const job = jobs.get(req.params.jobId);
    if (!job) {
      res.write(`data: ${JSON.stringify({ done: true, sent: 0, failed: 0, total: 0, failures: [] })}\n\n`);
      clearInterval(timer);
      return res.end();
    }
    res.write(`data: ${JSON.stringify(job)}\n\n`);
    if (job.done) {
      clearInterval(timer);
      res.end();
    }
  }, 400);

  req.on('close', () => clearInterval(timer));
});

module.exports = router;
