#!/usr/bin/env node
// Interaktive Einrichtung fuer einen Linux-Server: installiert
// Abhaengigkeiten, fragt nur das ab, was sich nicht automatisch
// herausfinden laesst, prueft Bot-Token und Server-ID sofort live gegen die
// Discord-API, richtet auf Wunsch einen Reverse-Proxy mit automatischem
// HTTPS (Caddy) und einen systemd-Dienst ein, damit das Panel dauerhaft und
// nach einem Neustart automatisch laeuft. Erneut ausfuehrbar: vorhandene
// .env-Werte werden als Vorschlag uebernommen, nichts wird stillschweigend
// ueberschrieben.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline/promises');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const CADDYFILE = '/etc/caddy/Caddyfile';
const SYSTEMD_UNIT_PATH = '/etc/systemd/system/discord-panel.service';

// View Channels, Send Messages, Read Message History, Embed Links,
// Attach Files, Manage Roles, Kick Members -- die Berechtigungen, die die
// Funktionsliste des Panels tatsaechlich braucht.
const INVITE_PERMISSIONS = 268553218;

const ok = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.log(`  ! ${msg}`);
const fail = (msg) => console.log(`  ✗ ${msg}`);
const section = (title) => console.log(`\n${title}\n${'─'.repeat(title.length)}`);

function isRoot() {
  return typeof process.getuid === 'function' && process.getuid() === 0;
}

function commandExists(cmd) {
  return spawnSync('bash', ['-c', `command -v ${cmd}`]).status === 0;
}

// Fuehrt einen Shell-Befehl sichtbar im Terminal aus (Passwort-Abfragen von
// sudo landen unabhaengig von stdio immer auf /dev/tty und funktionieren
// deshalb auch hier).
function sh(cmdString) {
  return spawnSync('bash', ['-c', cmdString], { stdio: 'inherit' });
}

function maybeSudo(cmdString) {
  return isRoot() ? cmdString : `sudo ${cmdString}`;
}

function checkNodeVersion() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 5)) {
    fail(`Node.js ${process.versions.node} gefunden, mindestens 22.5 wird gebraucht (wegen des eingebauten node:sqlite).`);
    console.log('  Aktualisieren z. B. über NodeSource: https://github.com/nodesource/distributions');
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

// Rät beim erneuten Ausführen die zuletzt gewählte Betriebsart, statt bei
// jedem Lauf wieder bei 1 anzufangen.
function inferReachabilityMode(existing) {
  const url = existing.BASE_URL || '';
  if (url.startsWith('https://')) return '2';
  if (url && !/localhost|127\.0\.0\.1/.test(url)) return '3';
  return '1';
}

async function chooseReachability(rl, existing) {
  section('6 · Erreichbarkeit');
  console.log('  Wie soll das Panel erreichbar sein?');
  console.log('    1) Nur lokal auf diesem Server (zum Testen, z. B. über einen SSH-Tunnel)');
  console.log('    2) Über eine Domain, die schon auf diesen Server zeigt — richtet automatisch HTTPS ein (empfohlen)');
  console.log('    3) Direkt über die Server-IP, ohne HTTPS (nicht empfohlen)');

  const port = existing.PORT || '3000';
  const inferred = inferReachabilityMode(existing);
  let mode;
  for (;;) {
    mode = (await ask(rl, 'Auswahl (1/2/3)', inferred)).trim();
    if (['1', '2', '3'].includes(mode)) break;
    fail('Bitte 1, 2 oder 3 eingeben.');
  }

  if (mode === '1') {
    return { mode, baseUrl: `http://localhost:${port}`, host: '127.0.0.1', trustProxy: '0', port };
  }

  if (mode === '2') {
    const defaultDomain = existing.BASE_URL && existing.BASE_URL.startsWith('https://') ? existing.BASE_URL.replace(/^https:\/\//, '') : '';
    const domain = await ask(rl, 'Domain (z. B. panel.example.com), muss schon per DNS auf diesen Server zeigen', defaultDomain, { required: true });
    return { mode, domain, baseUrl: `https://${domain}`, host: '127.0.0.1', trustProxy: '1', port };
  }

  warn('Ohne HTTPS werden Anmeldedaten und Sitzungs-Cookie unverschlüsselt übertragen.');
  warn('Nur verwenden, wenn der Server ausschließlich aus einem vertrauenswürdigen Netz erreichbar ist.');
  const defaultAddress = existing.BASE_URL ? existing.BASE_URL.replace(/^https?:\/\//, '').replace(/:\d+$/, '') : '';
  const address = await ask(rl, 'Server-IP oder Adresse', defaultAddress, { required: true });
  return { mode, baseUrl: `http://${address}:${port}`, host: '0.0.0.0', trustProxy: '0', port };
}

function ensureFirewallPort(port) {
  if (!commandExists('ufw')) return;
  const status = spawnSync('bash', ['-c', maybeSudo('ufw status')], { encoding: 'utf8' });
  if (!status.stdout || !/Status:\s*active/i.test(status.stdout)) return; // ufw installiert, aber nicht aktiv
  sh(maybeSudo(`ufw allow ${port}/tcp`));
  ok(`Firewall (ufw): Port ${port}/tcp freigegeben.`);
}

function ensureFirewallWebPorts() {
  if (!commandExists('ufw')) return;
  const status = spawnSync('bash', ['-c', maybeSudo('ufw status')], { encoding: 'utf8' });
  if (!status.stdout || !/Status:\s*active/i.test(status.stdout)) return;
  sh(maybeSudo('ufw allow 80/tcp'));
  sh(maybeSudo('ufw allow 443/tcp'));
  ok('Firewall (ufw): Ports 80/443 freigegeben.');
}

function printManualCaddyInstructions(domain, port) {
  console.log('  Trage von Hand in deinen Reverse-Proxy ein, dass er');
  console.log(`  https://${domain} an 127.0.0.1:${port} weiterleitet (mit TLS-Zertifikat für die Domain).`);
}

// Installiert Caddy (falls nötig) und trägt die Domain als Reverse-Proxy
// zum Panel ein. Caddy besorgt das HTTPS-Zertifikat danach von selbst.
function installCaddyReverseProxy(domain, port) {
  section('Reverse-Proxy für automatisches HTTPS (Caddy)');

  if (!commandExists('caddy')) {
    if (!commandExists('apt-get')) {
      warn('Caddy ist nicht installiert und kein apt verfügbar (nur Debian/Ubuntu wird automatisiert).');
      printManualCaddyInstructions(domain, port);
      return;
    }
    console.log('  Installiere Caddy (braucht sudo-Rechte, evtl. Passwort-Abfrage) …');
    sh(maybeSudo('apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl'));
    sh(`curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | ${maybeSudo('gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg')}`);
    sh(`curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | ${maybeSudo('tee /etc/apt/sources.list.d/caddy-stable.list')}`);
    sh(maybeSudo('apt-get update'));
    sh(maybeSudo('apt-get install -y caddy'));
    if (!commandExists('caddy')) {
      fail('Caddy-Installation fehlgeschlagen.');
      printManualCaddyInstructions(domain, port);
      return;
    }
  }
  ok('Caddy ist installiert.');

  const alreadyPresent = spawnSync('bash', ['-c', maybeSudo(`grep -Fq ${JSON.stringify(domain)} ${CADDYFILE}`)]).status === 0;
  if (alreadyPresent) {
    ok(`Eintrag für ${domain} ist schon in ${CADDYFILE} vorhanden.`);
  } else {
    const block = `\n${domain} {\n\treverse_proxy 127.0.0.1:${port}\n}\n`;
    const tmpFile = path.join(os.tmpdir(), `caddy-block-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, block);
    const wrote = sh(maybeSudo(`sh -c 'cat ${tmpFile} >> ${CADDYFILE}'`)).status === 0;
    fs.unlinkSync(tmpFile);
    if (!wrote) {
      fail(`Konnte ${CADDYFILE} nicht schreiben.`);
      printManualCaddyInstructions(domain, port);
      return;
    }
    ok(`Eintrag für ${domain} zu ${CADDYFILE} hinzugefügt.`);
  }

  ensureFirewallWebPorts();
  sh(maybeSudo('systemctl enable --now caddy'));
  if (sh(maybeSudo('systemctl reload caddy')).status !== 0) sh(maybeSudo('systemctl restart caddy'));

  console.log(`\n  Sobald die DNS für ${domain} auf diesen Server zeigt, ist das Panel automatisch`);
  console.log('  über HTTPS erreichbar — Caddy besorgt das Zertifikat selbständig bei Let\'s Encrypt.');
}

// Richtet einen systemd-Dienst ein, damit das Panel im Hintergrund laeuft,
// einen Absturz automatisch uebersteht und nach einem Server-Neustart von
// selbst wieder hochkommt.
async function installSystemdService(rl) {
  section('Dauerhaft laufen lassen (systemd)');

  if (!commandExists('systemctl')) {
    warn('systemd wurde nicht gefunden — Dienst-Einrichtung übersprungen.');
    console.log('  Alternative: ein Prozessmanager wie pm2, oder "npm start" in einer Sitzung, die');
    console.log('  weiterläuft (z. B. tmux/screen).');
    return false;
  }

  const wantService = await ask(rl, 'Als systemd-Dienst einrichten, damit das Panel automatisch startet und bei Absturz neu startet?', 'J');
  if (/^n/i.test(wantService)) {
    console.log('  Übersprungen. Später manuell starten mit: npm start');
    return false;
  }

  const serviceUser = process.env.SUDO_USER || os.userInfo().username;
  if (serviceUser === 'root') {
    warn('Läuft aktuell als root — der Dienst würde ebenfalls als root laufen.');
    warn('Empfohlen ist ein eigener Benutzer, z. B. vorher: adduser discord-panel');
  }

  const unit = [
    '[Unit]',
    'Description=Discord-Panel',
    'After=network-online.target',
    'Wants=network-online.target',
    '',
    '[Service]',
    'Type=simple',
    `User=${serviceUser}`,
    `WorkingDirectory=${ROOT}`,
    `ExecStart=${process.execPath} ${path.join(ROOT, 'src', 'index.js')}`,
    'Restart=on-failure',
    'RestartSec=5',
    'Environment=NODE_ENV=production',
    '',
    '[Install]',
    'WantedBy=multi-user.target',
    '',
  ].join('\n');

  const tmpFile = path.join(os.tmpdir(), `discord-panel-${Date.now()}.service`);
  fs.writeFileSync(tmpFile, unit);
  const copied = sh(maybeSudo(`cp ${tmpFile} ${SYSTEMD_UNIT_PATH}`)).status === 0;
  fs.unlinkSync(tmpFile);
  if (!copied) {
    fail('Dienst-Datei konnte nicht geschrieben werden.');
    return false;
  }

  sh(maybeSudo('systemctl daemon-reload'));
  const enabled = sh(maybeSudo('systemctl enable --now discord-panel')).status === 0;
  if (!enabled) {
    fail('Dienst konnte nicht gestartet werden. Details: sudo systemctl status discord-panel');
    return false;
  }

  ok('Dienst „discord-panel“ läuft und startet ab jetzt automatisch, auch nach einem Server-Neustart.');
  console.log('  Status ansehen:  sudo systemctl status discord-panel');
  console.log('  Logs live sehen: sudo journalctl -u discord-panel -f');
  console.log('  Neu starten:     sudo systemctl restart discord-panel');
  console.log('  Stoppen:         sudo systemctl stop discord-panel');
  return true;
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
    `HOST=${env.HOST}`,
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
  console.log('Discord-Panel — Einrichtung für einen Linux-Server\n');

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

  const reach = await chooseReachability(rl, existing);

  const redirectUri = `${reach.baseUrl}/auth/callback`;
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

  const env = {
    DISCORD_CLIENT_ID: appInfo.clientId,
    DISCORD_CLIENT_SECRET: clientSecret,
    DISCORD_BOT_TOKEN: botToken,
    DISCORD_GUILD_ID: guildId,
    DISCORD_REDIRECT_URI: redirectUri,
    BASE_URL: reach.baseUrl,
    PORT: reach.port,
    HOST: reach.host,
    SESSION_SECRET: sessionSecret,
    PANEL_ADMIN_IDS: adminId,
    PANEL_ALLOWED_ROLE_IDS: existing.PANEL_ALLOWED_ROLE_IDS || '',
    PANEL_SERVER_ADMIN_ACCESS: existing.PANEL_SERVER_ADMIN_ACCESS || '1',
    TRUST_PROXY: reach.trustProxy,
    DM_MAX_RECIPIENTS: existing.DM_MAX_RECIPIENTS || '200',
    DM_DELAY_MS: existing.DM_DELAY_MS || '1500',
  };
  writeEnvFile(env);
  ok('.env geschrieben.');

  if (reach.mode === '2') installCaddyReverseProxy(reach.domain, reach.port);
  else if (reach.mode === '3') ensureFirewallPort(reach.port);

  const serviceRunning = await installSystemdService(rl);
  rl.close();

  section('Fertig');
  if (!adminId) {
    console.log('  Keine feste Admin-ID gesetzt: melde dich als Erste(r) mit Server-Administrator-Rechten');
    console.log('  im Panel an, um automatisch Panel-Administrator zu werden.');
  }
  console.log(`  Panel-Adresse: ${reach.baseUrl}`);

  if (serviceRunning) {
    console.log('\n  Das Panel läuft bereits als Dienst — kein weiterer Start nötig.');
    return;
  }

  const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
  const start = await rl2.question('\nPanel jetzt im Vordergrund starten (zum Testen)? (J/n) ');
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

module.exports = { inviteUrl, writeEnvFile, validateBotToken, validateGuild, inferReachabilityMode, INVITE_PERMISSIONS };
