require('dotenv').config();

function list(name) {
  return (process.env[name] || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Fehlende Umgebungsvariable: ${name} (siehe .env.example)`);
  return v;
}

const trustProxy = process.env.TRUST_PROXY === '1';
const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

if (baseUrl.startsWith('https://') && !trustProxy) {
  throw new Error(
    'BASE_URL ist https, aber TRUST_PROXY ist nicht auf 1 gesetzt. ' +
      'Hinter einem HTTPS-Reverse-Proxy muss TRUST_PROXY=1 gesetzt sein, ' +
      'sonst wird das Sitzungs-Cookie nie als Secure gesendet und niemand kann sich anmelden.'
  );
}

module.exports = {
  port: Number(process.env.PORT || 3000),
  // 127.0.0.1 als sicherer Default: auf einem Server soll nur der lokale
  // Reverse-Proxy (Caddy/nginx) das Panel erreichen koennen, nicht das
  // offene Internet direkt. Nur wer bewusst ohne Reverse-Proxy oeffentlich
  // erreichbar sein will, setzt HOST=0.0.0.0.
  host: process.env.HOST || '127.0.0.1',
  baseUrl,
  trustProxy,
  sessionSecret: need('SESSION_SECRET'),

  discord: {
    clientId: need('DISCORD_CLIENT_ID'),
    clientSecret: need('DISCORD_CLIENT_SECRET'),
    botToken: need('DISCORD_BOT_TOKEN'),
    guildId: need('DISCORD_GUILD_ID'),
    redirectUri: process.env.DISCORD_REDIRECT_URI || `${baseUrl}/auth/callback`,
  },

  panelAdminIds: list('PANEL_ADMIN_IDS'),
  panelAllowedRoleIds: list('PANEL_ALLOWED_ROLE_IDS'),
  panelServerAdminAccess: process.env.PANEL_SERVER_ADMIN_ACCESS !== '0',

  dmMaxRecipients: Number(process.env.DM_MAX_RECIPIENTS || 200),
  dmDelayMs: Number(process.env.DM_DELAY_MS || 1500),

  dataDir: require('path').join(__dirname, '..', 'data'),
};
