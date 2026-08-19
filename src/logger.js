/**
 * Zentraler Logger.
 *
 * Die Redact-Liste ist sicherheitsrelevant: Bot-Token, OAuth-Secrets und
 * Session-Cookies dürfen unter keinen Umständen in einer Logzeile landen —
 * auch nicht, wenn irgendwo versehentlich ein ganzes Objekt geloggt wird.
 */
import pino from 'pino';
import { config } from './config.js';

const geheim = [
  'token',
  'DISCORD_TOKEN',
  'client_secret',
  'DISCORD_CLIENT_SECRET',
  'SESSION_SECRET',
  'access_token',
  'refresh_token',
  'authorization',
  'cookie',
  'set-cookie',
];

/** Erzeugt Pfade wie "req.headers.authorization" für die Redact-Option. */
const pfade = geheim.flatMap((k) => [
  k,
  `*.${k}`,
  `req.headers.${k}`,
  `headers.${k}`,
  `body.${k}`,
]);

export const logger = pino({
  level: config.LOG_LEVEL,
  redact: { paths: pfade, censor: '[entfernt]' },
  // In der Entwicklung lesbar, in der Produktion als JSON für Log-Sammler.
  transport: config.isProduction
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
});

export default logger;
