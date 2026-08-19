/**
 * Einstiegspunkt.
 *
 * Reihenfolge: Konfiguration prüfen → Datenbank öffnen → Webserver starten →
 * Bot anmelden. Der Webserver läuft bewusst auch dann, wenn die Anmeldung bei
 * Discord scheitert — sonst käme man nicht ins Panel, um die Ursache zu sehen.
 */
import fs from 'node:fs';
import { config } from './config.js';
import { logger } from './logger.js';
import { initDb, closeDb } from './db/index.js';
import { initRepos } from './db/repos/index.js';
import { createClient, login } from './bot/client.js';
import { beiBereit, registriereEreignisse } from './bot/ready.js';
import { createServer } from './web/server.js';

fs.mkdirSync(config.uploadsDir, { recursive: true });
fs.mkdirSync(config.generatedDir, { recursive: true });

const db = initDb(config.dbFile, logger);
const repos = initRepos(db);
logger.info({ datei: config.dbFile }, 'Datenbank bereit');

const client = createClient();

/**
 * Gemeinsamer Zustand für die Web-Schicht. Als Funktion, weil `guild` erst
 * gesetzt ist, sobald der Bot verbunden ist — die Routen greifen bei jeder
 * Anfrage auf den aktuellen Stand zu.
 */
let guild = null;
const getKontext = () => ({ client, guild, repos, config, log: logger });

const { app, store } = createServer({ db, repos, config, log: logger, getKontext });

const server = app.listen(config.PORT, () => {
  logger.info(`Panel erreichbar unter ${config.BASE_URL}`);
});

registriereEreignisse(client, { repos, config, log: logger });

client.once('clientReady', async () => {
  guild = await beiBereit(client, { repos, config, log: logger });
});

client.on('error', (err) => logger.error({ err }, 'Discord-Client-Fehler'));
client.on('shardError', (err) => logger.error({ err }, 'Verbindungsfehler zu Discord'));

try {
  await login(client, config.DISCORD_TOKEN, logger);
} catch {
  logger.warn(
    'Der Bot konnte sich nicht anmelden. Das Panel läuft trotzdem, ' +
      'damit die Einstellungen einsehbar bleiben — Versand und Rollenregeln ' +
      'funktionieren erst nach einer erfolgreichen Anmeldung.',
  );
}

/** Sauberes Herunterfahren: erst keine neuen Anfragen, dann Verbindungen zu. */
let faehrtHerunter = false;
async function herunterfahren(signal) {
  if (faehrtHerunter) return;
  faehrtHerunter = true;
  logger.info({ signal }, 'Herunterfahren …');

  server.close();
  store.stop?.();
  try {
    await client.destroy();
  } catch (err) {
    logger.warn({ err }, 'Discord-Verbindung konnte nicht sauber geschlossen werden');
  }
  closeDb();
  logger.info('Beendet.');
  process.exit(0);
}

process.on('SIGINT', () => herunterfahren('SIGINT'));
process.on('SIGTERM', () => herunterfahren('SIGTERM'));
process.on('unhandledRejection', (err) => logger.error({ err }, 'Unbehandelte Promise-Ablehnung'));
