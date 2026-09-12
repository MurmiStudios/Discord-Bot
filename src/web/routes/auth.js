const express = require('express');
const crypto = require('crypto');
const config = require('../../config');
const repo = require('../../db/repo');
const { resolveAccessLevel } = require('../../discord/permissions');
const { login: loginLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.get('/login', loginLimiter, (req, res) => {
  if (req.session.user) return res.redirect('/');
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;
  const params = new URLSearchParams({
    client_id: config.discord.clientId,
    redirect_uri: config.discord.redirectUri,
    response_type: 'code',
    scope: 'identify',
    state,
    prompt: 'none',
  });
  const bootstrapOpen = config.panelAdminIds.length === 0 && !repo.adminBootstrap.get();
  res.render('login', { title: 'Anmeldung', authUrl: `https://discord.com/api/oauth2/authorize?${params}`, bootstrapOpen });
});

router.get('/auth/callback', loginLimiter, async (req, res) => {
  const { code, state } = req.query;
  if (!state || state !== req.session.oauthState) {
    return res.status(403).render('errors/403', { title: 'Anmeldung fehlgeschlagen', reason: 'Der Rückweg von Discord konnte nicht bestätigt werden (state stimmt nicht). Bitte erneut versuchen.' });
  }
  delete req.session.oauthState;
  if (!code) return res.redirect('/login');

  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.discord.clientId,
        client_secret: config.discord.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.discord.redirectUri,
      }),
    });
    if (!tokenRes.ok) throw new Error(`Token-Austausch fehlgeschlagen (${tokenRes.status})`);
    const token = await tokenRes.json();

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `${token.token_type} ${token.access_token}` },
    });
    if (!userRes.ok) throw new Error(`Nutzerabfrage fehlgeschlagen (${userRes.status})`);
    const discordUser = await userRes.json();

    const accessLevel = await resolveAccessLevel(discordUser);
    req.session.user = {
      id: discordUser.id,
      username: discordUser.username,
      avatar: discordUser.avatar,
      accessLevel,
      accessCheckedAt: Date.now(),
    };

    repo.audit.log({
      kind: 'anmeldung',
      actorId: discordUser.id,
      actorTag: discordUser.username,
      summary: `${discordUser.username} angemeldet`,
      success: !!accessLevel,
      reason: accessLevel ? null : 'kein Zugriff auf das Panel',
    });

    const returnTo = req.session.returnTo;
    delete req.session.returnTo;
    res.redirect(returnTo && returnTo.startsWith('/') ? returnTo : '/');
  } catch (err) {
    console.error('[auth]', err);
    res.status(500).render('errors/403', { title: 'Anmeldung fehlgeschlagen', reason: 'Discord konnte nicht erreicht werden. Bitte später erneut versuchen.' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
