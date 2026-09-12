#!/usr/bin/env node
// Interaktive Einrichtung: installiert Abhaengigkeiten, fragt nur das ab,
// was sich nicht automatisch herausfinden laesst, und prueft Bot-Token und
// Server-ID sofort live gegen die Discord-API statt das erst beim ersten
// Start scheitern zu lassen. Erneut ausfuehrbar: vorhandene .env-Werte
// werden als Vorschlag uebernommen, nichts wird stillschweigend ueberschrieben.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline/promises');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');

// View Channels, Send Messages, Read Message History, Embed Links,
// Attach Files, Manage Roles, Kick Members -- die Berechtigungen, die die
// Funktionsliste des Panels tatsaechlich braucht.
const INVITE_PERMISSIONS = 268553218;

const ok = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.log(`  ! ${msg}`);
const fail = (msg) => console.log(`  ✗ ${msg}`);
const section = (title) => console.log(`\n${title}\n${'─'.repeat(title.length)}`);

function checkNodeVersion() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 5)) {
    fail(`Node.js ${process.versions.node} gefunden, mindestens 22.5 wird gebraucht (wegen des eingebauten node:sqlite).`);
    console.log('  Bitte Node.js aktualisieren, z. B. über https://nodejs.org oder nvm.');
    process.exit(1);
  }
  ok(`Node.js ${process.versions.node}`);
}

function installDependencies() {
  const needsInstall = !fs.existsSync(path.join(ROOT, 'node_modules'));
  console.log(needsInstall ? '  Installiere Abhängigkeiten (npm install) …' : '  Prüfe Abhängigkeiten …');
  const result = spawnSync('npm', ['install', '--no-fund'], { cwd: ROOT, stdio: needsInstall ? 'inherit' : 'ignore' });
  if (result.status !== 0) {
    fail('npm install fehlgeschlagen. Bitte Fehlermeldung oben prüfen.');
    process.exit(1);
  }
  ok('Abhängigkeiten installiert.');
}

function loadExistingEnv() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const dotenv = require('dotenv');
  return dotenv.parse(fs.readFileSync(ENV_PATH));
}

async function ask(rl, question, def, { required = false, secretDefault = false } = {}) {
  const shown = def ? (secretDefault ? 'vorhandenen Wert behalten' : def) : null;
  const suffix = shown ? ` [${shown}]` : '';
  for (;;) {
    const answer = (await rl.question(`  ${question}${suffix}: `)).trim();
    const value = answer || def || '';
    if (required && !value) {
      fail('Darf nicht leer sein.');
      continue;
    }
    return value;
  }
}

async function discordGet(token, endpoint) {
  try {
    const res = await fetch(`https://discord.com/api/v10${endpoint}`, { headers: { Authorization: `Bot ${token}` } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function validateBotToken(token) {
  if (!token) return null;
  const [user, app] = await Promise.all([discordGet(token, '/users/@me'), discordGet(token, '/oauth2/applications/@me')]);
  if (!user || !app) return null;
  return { botTag: user.username, appName: app.name, clientId: app.id };
}

async function validateGuild(token, guildId) {
  if (!/^\d{15,21}$/.test(guildId)) return null;
  return discordGet(token, `/guilds/${guildId}`);
}

function inviteUrl(clientId) {
  return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${INVITE_PERMISSIONS}&scope=bot`;
}

function writeEnvFile(env) {
  const lines = [
    '# Von scripts/setup.js geschrieben -- erneut ausführbar, vorhandene Werte',
    '# werden dabei als Vorschlag übernommen. Siehe .env.example für Details.',
    '',
    `DISCORD_CLIENT_ID=${env.DISCORD_CLIENT_ID}`,
    `DISCORD_CLIENT_SECRET=${env.DISCORD_CLIENT_SECRET}`,
    `DISCORD_BOT_TOKEN=${env.DISCORD_BOT_TOKEN}`,
    `DISCORD_GUILD_ID=${env.DISCORD_GUILD_ID}`,
    `DISCORD_REDIRECT_URI=${env.DISCORD_REDIRECT_URI}`,
    '',
    `BASE_URL=${env.BASE_URL}`,
    `PORT=${env.PORT}`,
    '',
    `SESSION_SECRET=${env.SESSION_SECRET}`,
    '',
    `PANEL_ADMIN_IDS=${env.PANEL_ADMIN_IDS}`,
    `PANEL_ALLOWED_ROLE_IDS=${env.PANEL_ALLOWED_ROLE_IDS}`,
    `PANEL_SERVER_ADMIN_ACCESS=${env.PANEL_SERVER_ADMIN_ACCESS}`,
    '',
    `TRUST_PROXY=${env.TRUST_PROXY}`,
    '',
    `DM_MAX_RECIPIENTS=${env.DM_MAX_RECIPIENTS}`,
    `DM_DELAY_MS=${env.DM_DELAY_MS}`,
    '',
  ];
  fs.writeFileSync(ENV_PATH, lines.join('\n'), { mode: 0o600 });
}

async function main() {
  console.log('Discord-Panel — Einrichtung\n');

  section('1 · Node.js');
  checkNodeVersion();

  section('2 · Abhängigkeiten');
  installDependencies();

  const existing = loadExistingEnv();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  section('3 · Discord-Bot');
  console.log('  Anwendung anlegen (falls noch nicht geschehen): https://discord.com/developers/applications');
  console.log('  Dort: Bot hinzufügen → unter "Privileged Gateway Intents" die "Server Members Intent"');
  console.log('  einschalten → Token unter "Reset Token" erzeugen und kopieren.\n');

  let botToken = existing.DISCORD_BOT_TOKEN || '';
  let appInfo = null;
  while (!appInfo) {
    botToken = await ask(rl, 'Bot-Token', botToken, { required: true, secretDefault: true });
    appInfo = await validateBotToken(botToken);
    if (!appInfo) fail('Token ungültig oder Discord nicht erreichbar — bitte erneut versuchen.');
  }
  ok(`Bot erkannt: ${appInfo.botTag} (Anwendung „${appInfo.appName}“, Client-ID automatisch übernommen)`);

  section('4 · Anmeldung im Panel (OAuth2)');
  console.log('  In derselben Anwendung unter OAuth2 → General: Client Secret kopieren.\n');
  const clientSecret = await ask(rl, 'Client-Secret', existing.DISCORD_CLIENT_SECRET, { required: true, secretDefault: true });

  section('5 · Server');
  let guildId = existing.DISCORD_GUILD_ID || '';
  let guildInfo = null;
  while (!guildInfo) {
    guildId = await ask(rl, 'Server-ID (Entwicklermodus an, Rechtsklick auf den Server → ID kopieren)', guildId, { required: true });
    guildInfo = await validateGuild(botToken, guildId);
    if (!guildInfo) {
      fail('Der Bot ist nicht auf diesem Server (oder die ID ist falsch).');
      console.log(`  Zum Einladen öffnen: ${inviteUrl(appInfo.clientId)}`);
      await rl.question('  Weiter mit Enter, sobald der Bot eingeladen ist … ');
    }
  }
  ok(`Server erkannt: ${guildInfo.name}`);

  section('6 · Adresse des Panels');
  const baseUrl = (await ask(rl, 'Basis-URL (lokal einfach so lassen)', existing.BASE_URL || 'http://localhost:3000')).replace(/\/$/, '');
  const redirectUri = existing.DISCORD_REDIRECT_URI || `${baseUrl}/auth/callback`;
  console.log(`\n  Trage im Developer-Portal unter OAuth2 → Redirects genau diese Adresse ein:`);
  console.log(`    ${redirectUri}\n`);
  await rl.question('  Weiter mit Enter, sobald eingetragen … ');

  section('7 · Zugriff');
  const adminId = await ask(
    rl,
    'Deine Discord-User-ID für festen Admin-Zugriff (leer lassen: automatisch die erste Anmeldung mit Server-Administrator-Rechten)',
    existing.PANEL_ADMIN_IDS || ''
  );

  const sessionSecret = existing.SESSION_SECRET && existing.SESSION_SECRET.length >= 32 ? existing.SESSION_SECRET : crypto.randomBytes(32).toString('hex');
  if (!existing.SESSION_SECRET) ok('SESSION_SECRET automatisch erzeugt.');

  rl.close();

  const env = {
    DISCORD_CLIENT_ID: appInfo.clientId,
    DISCORD_CLIENT_SECRET: clientSecret,
    DISCORD_BOT_TOKEN: botToken,
    DISCORD_GUILD_ID: guildId,
    DISCORD_REDIRECT_URI: redirectUri,
    BASE_URL: baseUrl,
    PORT: existing.PORT || '3000',
    SESSION_SECRET: sessionSecret,
    PANEL_ADMIN_IDS: adminId,
    PANEL_ALLOWED_ROLE_IDS: existing.PANEL_ALLOWED_ROLE_IDS || '',
    PANEL_SERVER_ADMIN_ACCESS: existing.PANEL_SERVER_ADMIN_ACCESS || '1',
    TRUST_PROXY: baseUrl.startsWith('https://') ? '1' : existing.TRUST_PROXY || '0',
    DM_MAX_RECIPIENTS: existing.DM_MAX_RECIPIENTS || '200',
    DM_DELAY_MS: existing.DM_DELAY_MS || '1500',
  };
  writeEnvFile(env);

  section('Fertig');
  ok('.env geschrieben.');
  if (!adminId) {
    console.log('  Keine feste Admin-ID gesetzt: melde dich als Erste(r) mit Server-Administrator-Rechten');
    console.log('  im Panel an, um automatisch Panel-Administrator zu werden.');
  }

  const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
  const start = await rl2.question('\nPanel jetzt starten? (J/n) ');
  rl2.close();
  if (!/^n/i.test(start.trim())) {
    spawnSync('npm', ['start'], { cwd: ROOT, stdio: 'inherit' });
  } else {
    console.log('Später starten mit: npm start');
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('\nEinrichtung abgebrochen:', err.message);
    process.exit(1);
  });
}

module.exports = { inviteUrl, writeEnvFile, validateBotToken, validateGuild, INVITE_PERMISSIONS };
