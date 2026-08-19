import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAuthorizeUrl, erzeugeState, stateGleich } from '../src/web/auth/oauth.js';

const BASIS = {
  clientId: '123456789012345678',
  redirectUri: 'http://localhost:3000/auth/callback',
};

test('Autorisierungs-URL enthält alle nötigen Parameter', () => {
  const state = erzeugeState();
  const url = new URL(buildAuthorizeUrl({ ...BASIS, state }));

  assert.equal(url.origin + url.pathname, 'https://discord.com/oauth2/authorize');
  assert.equal(url.searchParams.get('client_id'), BASIS.clientId);
  assert.equal(url.searchParams.get('redirect_uri'), BASIS.redirectUri);
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('state'), state);
});

test('es wird nur der Scope identify angefordert', () => {
  // Mehr braucht das Panel nicht: Mitgliedschaft und Rechte kommen über den
  // Bot-Token, nicht über vom Nutzer gewährte Scopes.
  const url = new URL(buildAuthorizeUrl({ ...BASIS, state: erzeugeState() }));
  assert.equal(url.searchParams.get('scope'), 'identify');
});

test('state ist lang genug und jedes Mal anders', () => {
  const a = erzeugeState();
  const b = erzeugeState();
  assert.notEqual(a, b);
  assert.ok(a.length >= 40, `state zu kurz: ${a.length}`);
  // base64url — muss ohne Kodierung in eine URL passen.
  assert.match(a, /^[A-Za-z0-9_-]+$/);
});

test('stateGleich erkennt Übereinstimmung und Abweichung', () => {
  const s = erzeugeState();
  assert.equal(stateGleich(s, s), true);
  assert.equal(stateGleich(s, erzeugeState()), false);
});

test('stateGleich weist fehlende und falsch getypte Werte ab', () => {
  const s = erzeugeState();
  assert.equal(stateGleich(s, undefined), false);
  assert.equal(stateGleich(s, null), false);
  assert.equal(stateGleich(s, ''), false);
  assert.equal(stateGleich(undefined, undefined), false, 'zwei fehlende Werte sind keine Übereinstimmung');
  assert.equal(stateGleich(s, 12345), false);
  assert.equal(stateGleich(s, [s]), false);
});

test('stateGleich stolpert nicht über unterschiedliche Längen', () => {
  // timingSafeEqual wirft bei ungleicher Länge — das muss abgefangen sein.
  assert.doesNotThrow(() => stateGleich('kurz', erzeugeState()));
  assert.equal(stateGleich('kurz', erzeugeState()), false);
});
