import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PFLICHT = {
  DISCORD_TOKEN: 'testtoken',
  DISCORD_CLIENT_ID: '123456789012345678',
  DISCORD_CLIENT_SECRET: 'testgeheimnis',
  GUILD_ID: '987654321098765432',
  OAUTH_REDIRECT_URI: 'http://127.0.0.1:3000/auth/callback',
  SESSION_SECRET: '0123456789abcdef0123456789abcdef0123456789abcdef',
};

/**
 * Lädt die Konfiguration in einem eigenen Prozess. Nötig, weil config.js beim
 * Fehlschlag process.exit() aufruft und den Zustand einmalig einfriert.
 */
function ladeConfig(zusatz) {
  const skript =
    "import('./src/config.js').then(({config}) => " +
    'console.log(JSON.stringify({isProduction: config.isProduction, ' +
    'unverschluesselt: config.unverschluesselt, secureCookie: ' +
    'config.isProduction && !config.unverschluesselt})));';

  try {
    const aus = execFileSync(process.execPath, ['--input-type=module', '-e', skript], {
      cwd: WURZEL,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      // Eine echte .env im Projektverzeichnis darf den Test nicht verfälschen.
      env: { PATH: process.env.PATH, DOTENV_CONFIG_PATH: '/dev/null', ...PFLICHT, ...zusatz },
    });
    return { ok: true, config: JSON.parse(aus.trim().split('\n').at(-1)) };
  } catch (err) {
    return { ok: false, ausgabe: String(err.stderr ?? '') + String(err.stdout ?? '') };
  }
}

test('Entwicklungsmodus über http läuft ohne Zusatzschalter', () => {
  const r = ladeConfig({ NODE_ENV: 'development', BASE_URL: 'http://127.0.0.1:3000' });
  assert.equal(r.ok, true);
  assert.equal(r.config.isProduction, false);
});

test('Produktion über http bricht ohne ALLOW_INSECURE_HTTP ab', () => {
  const r = ladeConfig({ NODE_ENV: 'production', BASE_URL: 'http://127.0.0.1:3000' });
  assert.equal(r.ok, false, 'unverschlüsselter Produktionsbetrieb darf nicht versehentlich passieren');
  assert.match(r.ausgabe, /ALLOW_INSECURE_HTTP=true/, 'die Meldung muss den Ausweg nennen');
});

test('Produktion über http läuft mit ALLOW_INSECURE_HTTP', () => {
  const r = ladeConfig({
    NODE_ENV: 'production',
    BASE_URL: 'http://127.0.0.1:3000',
    ALLOW_INSECURE_HTTP: 'true',
  });
  assert.equal(r.ok, true);
  assert.equal(r.config.isProduction, true);
  assert.equal(r.config.unverschluesselt, true);
  // Der Kern: über http darf das Cookie nicht als Secure markiert sein,
  // sonst sendet der Browser es nie und die Anmeldung scheitert lautlos.
  assert.equal(r.config.secureCookie, false, 'Secure-Flag muss über http aus sein');
});

test('Produktion über https setzt das Secure-Flag', () => {
  const r = ladeConfig({ NODE_ENV: 'production', BASE_URL: 'https://panel.example.com' });
  assert.equal(r.ok, true);
  assert.equal(r.config.unverschluesselt, false);
  assert.equal(r.config.secureCookie, true);
});

test('der Schalter lockert https nicht auf', () => {
  const r = ladeConfig({
    NODE_ENV: 'production',
    BASE_URL: 'https://panel.example.com',
    ALLOW_INSECURE_HTTP: 'true',
  });
  assert.equal(r.ok, true);
  assert.equal(r.config.secureCookie, true, 'bei https bleibt das Secure-Flag gesetzt');
});

test('zu kurzes SESSION_SECRET wird in der Produktion abgelehnt', () => {
  const r = ladeConfig({
    NODE_ENV: 'production',
    BASE_URL: 'https://panel.example.com',
    SESSION_SECRET: 'zukurz',
  });
  assert.equal(r.ok, false);
  assert.match(r.ausgabe, /32 Zeichen/);
});

test('fehlende Pflichtwerte werden auf Deutsch gemeldet', () => {
  const skript = "import('./src/config.js');";
  try {
    execFileSync(process.execPath, ['--input-type=module', '-e', skript], {
      cwd: WURZEL,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      // Wie oben: eine echte .env im Projektverzeichnis darf den Test nicht
      // verfälschen — sonst wären die Pflichtwerte plötzlich gesetzt.
      env: { PATH: process.env.PATH, DOTENV_CONFIG_PATH: '/dev/null' },
    });
    assert.fail('ohne Pflichtwerte darf der Start nicht gelingen');
  } catch (err) {
    const ausgabe = String(err.stderr ?? '') + String(err.stdout ?? '');
    assert.match(ausgabe, /DISCORD_TOKEN/);
    assert.match(ausgabe, /Developer Portal/, 'die Meldung soll sagen, wo der Wert herkommt');
  }
});
