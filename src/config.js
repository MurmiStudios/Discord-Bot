/**
 * Liest und validiert die Umgebungsvariablen genau einmal beim Start.
 *
 * Grundsatz: Lieber sofort mit einer verständlichen deutschen Meldung
 * abbrechen, als später mitten im Betrieb an einer fehlenden Variable zu
 * scheitern. Der Bot-Token wird ausschliesslich hier gelesen und darf
 * nirgends sonst im Code weitergereicht oder protokolliert werden.
 */
import 'dotenv/config';
import path from 'node:path';
import { z } from 'zod';

/** "123, 456 ,789" → ["123","456","789"], leere Eingabe → [] */
const idList = z
  .string()
  .default('')
  .transform((raw) =>
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

/**
 * Pflichtfeld: fehlender und leerer Wert sollen dieselbe deutsche Meldung
 * ergeben. z.string().min(1, msg) allein greift nicht, wenn die Variable gar
 * nicht gesetzt ist — dann meldet zod seinen eigenen englischen Standardtext.
 */
const pflicht = (hinweis) =>
  z.preprocess((v) => (v == null ? '' : v), z.string().min(1, hinweis));

const boolish = (fallback) =>
  z
    .string()
    .default(fallback)
    .transform((v) => ['1', 'true', 'yes', 'ja'].includes(v.trim().toLowerCase()));

const schema = z.object({
  DISCORD_TOKEN: pflicht('fehlt — Bot-Token aus dem Developer Portal (Bot → Reset Token)'),
  DISCORD_CLIENT_ID: pflicht('fehlt — Application ID aus dem Developer Portal'),
  DISCORD_CLIENT_SECRET: pflicht('fehlt — OAuth2 → Client Secret im Developer Portal'),
  GUILD_ID: pflicht('fehlt — ID des Servers, den das Panel verwalten soll'),

  OAUTH_REDIRECT_URI: z
    .url('muss eine gültige URL sein und exakt der im Developer Portal hinterlegten entsprechen')
    .default('http://localhost:3000/auth/callback'),
  PANEL_ADMIN_IDS: idList,
  PANEL_REQUIRE_GUILD_ADMIN: boolish('true'),
  PANEL_ALLOWED_ROLE_IDS: idList,

  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  BASE_URL: z.url('muss eine gültige URL sein').default('http://localhost:3000'),
  SESSION_SECRET: pflicht('fehlt — erzeugen mit: openssl rand -hex 32'),
  TRUST_PROXY: boolish('false'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DATA_DIR: z.string().default('./data'),
  MAX_UPLOAD_MB: z.coerce.number().positive().max(64).default(8),
  MAX_IMAGE_DIMENSION: z.coerce.number().int().positive().max(20000).default(4000),

  DM_DELAY_MS: z.coerce.number().int().min(0).max(60000).default(1500),
  DM_MAX_RECIPIENTS: z.coerce.number().int().positive().max(5000).default(200),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

function fail(zeilen) {
  console.error('\n  Der Start wurde abgebrochen — die Konfiguration ist unvollständig:\n');
  for (const z of zeilen) console.error(`   • ${z}`);
  console.error(
    '\n  Lege eine Datei ".env" im Projektverzeichnis an (Vorlage: ".env.example")' +
      '\n  und trage die fehlenden Werte ein.\n',
  );
  process.exit(1);
}

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  fail(
    parsed.error.issues.map((i) => {
      const feld = i.path.join('.') || '(unbekannt)';
      return `${feld}: ${i.message}`;
    }),
  );
}

const env = parsed.data;

// Zusätzliche Regeln, die sich nicht sinnvoll im Schema ausdrücken lassen.
const nachtraeglich = [];
if (env.NODE_ENV === 'production') {
  if (env.SESSION_SECRET.length < 32) {
    nachtraeglich.push(
      'SESSION_SECRET muss in der Produktion mindestens 32 Zeichen haben. ' +
        'Erzeugen mit: openssl rand -hex 32',
    );
  }
  if (env.BASE_URL.startsWith('http://')) {
    nachtraeglich.push(
      'BASE_URL muss in der Produktion mit https:// beginnen, sonst funktionieren ' +
        'die Secure-Cookies nicht und die Anmeldung schlägt fehl.',
    );
  }
}
if (nachtraeglich.length) fail(nachtraeglich);

const dataDir = path.resolve(env.DATA_DIR);

export const config = Object.freeze({
  ...env,
  dataDir,
  dbFile: path.join(dataDir, 'app.db'),
  uploadsDir: path.join(dataDir, 'uploads'),
  generatedDir: path.join(dataDir, 'generated'),
  isProduction: env.NODE_ENV === 'production',
  maxUploadBytes: env.MAX_UPLOAD_MB * 1024 * 1024,
});

export default config;
