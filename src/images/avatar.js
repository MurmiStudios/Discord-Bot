/**
 * Lädt Profilbilder für den Renderer.
 *
 * Die URL wird bewusst NICHT direkt an loadImage() gereicht, sondern selbst
 * geholt: nur so lassen sich Zeitlimit, Grössenlimit und ein Cache
 * kontrollieren. Ein Massenversand an 50 Mitglieder soll das Discord-CDN nicht
 * 50-mal treffen, und der Vorschau-Endpunkt wird beim Tippen im Editor
 * mehrmals pro Sekunde aufgerufen.
 */
import { createCanvas, loadImage } from '@napi-rs/canvas';

const TIMEOUT_MS = 5000;
const MAX_BYTES = 5 * 1024 * 1024;
const CACHE_MAX = 100;
const CACHE_TTL_MS = 10 * 60 * 1000;

/** Einfacher LRU: Map behält Einfügereihenfolge, ältester Eintrag fliegt raus. */
const cache = new Map();

function ausCache(url) {
  const e = cache.get(url);
  if (!e) return null;
  if (Date.now() - e.zeit > CACHE_TTL_MS) {
    cache.delete(url);
    return null;
  }
  // Neu einsortieren, damit häufig genutzte Einträge nicht verdrängt werden.
  cache.delete(url);
  cache.set(url, e);
  return e.bild;
}

function inCache(url, bild) {
  cache.set(url, { bild, zeit: Date.now() });
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}

export function clearAvatarCache() {
  cache.clear();
}

/**
 * Zeichnet einen Ersatz-Avatar: farbiger Kreis mit dem Anfangsbuchstaben.
 * Ein fehlgeschlagener Bildabruf darf eine Willkommens-DM nie verhindern.
 */
export function platzhalterAvatar(name = '?', groesse = 256) {
  const canvas = createCanvas(groesse, groesse);
  const ctx = canvas.getContext('2d');

  // Farbe aus dem Namen ableiten, damit derselbe Nutzer immer dieselbe bekommt.
  let hash = 0;
  for (const z of String(name)) hash = (hash * 31 + z.codePointAt(0)) >>> 0;
  ctx.fillStyle = `hsl(${hash % 360}, 45%, 42%)`;
  ctx.fillRect(0, 0, groesse, groesse);

  const buchstabe = [...String(name).trim()][0]?.toUpperCase() ?? '?';
  ctx.fillStyle = '#ffffff';
  ctx.font = `${Math.round(groesse * 0.5)}px "Inter Bold"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(buchstabe, groesse / 2, groesse / 2);

  return canvas;
}

/**
 * Holt ein Avatarbild. Wirft nie — bei jedem Problem kommt der Platzhalter.
 * @returns {Promise<{bild: any, ersatz: boolean, grund?: string}>}
 */
export async function loadAvatar(url, nameFuerPlatzhalter = '?') {
  if (!url) {
    return { bild: platzhalterAvatar(nameFuerPlatzhalter), ersatz: true, grund: 'keine URL' };
  }

  const zwischengespeichert = ausCache(url);
  if (zwischengespeichert) return { bild: zwischengespeichert, ersatz: false };

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const laenge = Number(res.headers.get('content-length'));
    if (Number.isFinite(laenge) && laenge > MAX_BYTES) {
      throw new Error(`Bild zu gross (${laenge} Bytes)`);
    }

    const buf = Buffer.from(await res.arrayBuffer());
    // Content-Length kann fehlen oder lügen — nach dem Laden nochmal prüfen.
    if (buf.byteLength > MAX_BYTES) throw new Error(`Bild zu gross (${buf.byteLength} Bytes)`);

    const bild = await loadImage(buf);
    inCache(url, bild);
    return { bild, ersatz: false };
  } catch (err) {
    return {
      bild: platzhalterAvatar(nameFuerPlatzhalter),
      ersatz: true,
      grund: err instanceof Error ? err.message : String(err),
    };
  }
}
