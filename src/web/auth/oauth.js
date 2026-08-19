/**
 * Discord OAuth2 — von Hand statt über passport.
 *
 * passport-discord ist seit Jahren unmaintained, und passport brächte für
 * einen einzigen Anbieter viel Zeremonie mit. Wichtiger: wir brauchen ohnehin
 * explizite Kontrolle über den state-Parameter, der die Anmeldung gegen
 * CSRF absichert.
 *
 * Angefordert wird nur `identify`. Servermitgliedschaft und Rechte lesen wir
 * über den Bot-Token — das ist vertrauenswürdiger als vom Nutzer gelieferte
 * Scopes und spart einen zusätzlichen API-Aufruf.
 */
import crypto from 'node:crypto';

const AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
const TOKEN_URL = 'https://discord.com/api/oauth2/token';
const USER_URL = 'https://discord.com/api/users/@me';
const TIMEOUT_MS = 10000;

export function erzeugeState() {
  return crypto.randomBytes(32).toString('base64url');
}

/** Zeitkonstanter Vergleich — verhindert, dass sich der state erraten lässt. */
export function stateGleich(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function buildAuthorizeUrl({ clientId, redirectUri, state }) {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: 'identify',
    state,
    redirect_uri: redirectUri,
    prompt: 'none',
  });
  return `${AUTHORIZE_URL}?${p.toString()}`;
}

/**
 * Tauscht den Code gegen ein Zugriffstoken.
 * Die Client-Zugangsdaten gehen als HTTP-Basic-Auth mit, nicht im Body.
 */
export async function exchangeCode({ clientId, clientSecret, redirectUri, code }) {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Token-Tausch fehlgeschlagen (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function fetchDiscordUser(accessToken) {
  const res = await fetch(USER_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Nutzerdaten konnten nicht geladen werden (HTTP ${res.status})`);

  const u = await res.json();
  return {
    id: u.id,
    username: u.username,
    globalName: u.global_name ?? null,
    displayName: u.global_name || u.username,
    avatar: u.avatar,
    avatarUrl: u.avatar
      ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128`
      : `https://cdn.discordapp.com/embed/avatars/${(BigInt(u.id) >> 22n) % 6n}.png`,
  };
}
