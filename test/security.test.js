import test from 'node:test';
import assert from 'node:assert/strict';
import { baueHelmet } from '../src/web/security.js';

/**
 * Ruft die Helmet-Middleware ohne echten Server auf und gibt die gesetzte
 * Content-Security-Policy zurück.
 */
function holeCsp(config) {
  const middleware = baueHelmet(config);
  const kopfzeilen = {};
  const req = { secure: false };
  const res = {
    setHeader: (name, wert) => {
      kopfzeilen[name.toLowerCase()] = wert;
    },
    getHeader: () => undefined,
    removeHeader: () => {},
  };

  middleware(req, res, () => {});
  return kopfzeilen['content-security-policy'] ?? '';
}

const OHNE_TLS = { unverschluesselt: true };
const MIT_TLS = { unverschluesselt: false };

test('ohne TLS steht kein upgrade-insecure-requests in der Richtlinie', () => {
  // Das ist der Kern: die Direktive weist den Browser an, jede Unterressource
  // von http:// auf https:// umzuschreiben. Beim Betrieb über die Server-IP
  // ohne TLS scheitern dadurch Stylesheet und Skripte lautlos, und das Panel
  // erscheint als nacktes HTML.
  const csp = holeCsp(OHNE_TLS);
  assert.ok(csp.length > 0, 'es muss überhaupt eine Richtlinie gesetzt werden');
  assert.ok(
    !csp.includes('upgrade-insecure-requests'),
    `darf nicht enthalten sein, ist aber drin: ${csp}`,
  );
});

test('mit TLS wird upgrade-insecure-requests gesetzt', () => {
  const csp = holeCsp(MIT_TLS);
  assert.ok(csp.includes('upgrade-insecure-requests'));
});

test('Discords CDN ist für Profilbilder erlaubt', () => {
  for (const [name, config] of [
    ['ohne TLS', OHNE_TLS],
    ['mit TLS', MIT_TLS],
  ]) {
    const csp = holeCsp(config);
    const imgSrc = csp.split(';').find((d) => d.trim().startsWith('img-src'));
    assert.ok(imgSrc, `img-src fehlt (${name})`);
    assert.ok(imgSrc.includes('https://cdn.discordapp.com'), `CDN fehlt in img-src (${name})`);
  }
});

test('blob: bleibt für die Live-Vorschau erlaubt', () => {
  const imgSrc = holeCsp(OHNE_TLS)
    .split(';')
    .find((d) => d.trim().startsWith('img-src'));
  assert.ok(imgSrc.includes('blob:'), 'ohne blob: bliebe die Vorschau im Editor leer');
});

test('eigene Dateien dürfen als Stylesheet und Skript geladen werden', () => {
  const csp = holeCsp(OHNE_TLS);
  const teil = (name) => csp.split(';').find((d) => d.trim().startsWith(name)) ?? '';
  assert.ok(teil('style-src').includes("'self'"));
  assert.ok(teil('script-src').includes("'self'"));
});

test('die Richtlinie bleibt streng', () => {
  const csp = holeCsp(OHNE_TLS);
  // Inline-Skripte bleiben verboten — sonst wäre der CSP-Schutz wertlos.
  assert.ok(!csp.includes("'unsafe-inline'"), `unsafe-inline gefunden: ${csp}`);
  assert.ok(!csp.includes("'unsafe-eval'"));
  assert.ok(csp.includes("frame-ancestors 'none'"));
  assert.ok(csp.includes("object-src 'none'"));
});

test('die Anmeldung darf zu Discord weiterleiten', () => {
  // Ohne diesen Eintrag bräche der Absprung zur Discord-Anmeldung ab.
  const formAction = holeCsp(OHNE_TLS)
    .split(';')
    .find((d) => d.trim().startsWith('form-action'));
  assert.ok(formAction.includes('https://discord.com'));
});
