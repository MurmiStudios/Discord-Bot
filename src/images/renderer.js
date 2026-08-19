/**
 * Erzeugt die personalisierten Karten (Avatar + Name auf einem Hintergrund).
 *
 * Bewusst EINE Funktion für alle drei Einsatzorte — Willkommens-DM, Rollen-DM
 * und Live-Vorschau. Würde die Vorschau im Browser nachgebaut, wichen Schrift,
 * Kerning und Auflösung ab und die Vorschau würde lügen.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { ensureFontsRegistered, familieOderStandard } from './fonts.js';
import { loadAvatar } from './avatar.js';
import { normalizeConfig } from './templateSchema.js';

const MAX_TEXT_LEN = 64;

/** Steuerzeichen (C0 und C1) — sie verfälschen die Textmessung. */
const STEUERZEICHEN = /[\u0000-\u001F\u007F-\u009F]/g;

/**
 * Ersetzt Platzhalter und entschärft den eingesetzten Wert: Steuerzeichen raus
 * und harte Längenbegrenzung, damit ein absurd langer Name das Layout nicht
 * sprengt.
 */
function saeubern(wert) {
  return String(wert ?? '')
    .replace(STEUERZEICHEN, '')
    .trim()
    .slice(0, MAX_TEXT_LEN);
}

export function platzhalterErsetzen(vorlage, werte) {
  return String(vorlage ?? '').replace(/\{(\w+)\}/g, (treffer, name) =>
    name in werte ? saeubern(werte[name]) : treffer,
  );
}

/** Zeichnet den Hintergrund gemäss dem gewählten Anpassungsmodus. */
function hintergrundZeichnen(ctx, bild, breite, hoehe, fit) {
  const iw = bild.width;
  const ih = bild.height;
  if (fit === 'stretch') {
    ctx.drawImage(bild, 0, 0, breite, hoehe);
    return;
  }
  // cover füllt die Fläche und schneidet über, contain zeigt alles und lässt Rand.
  const faktor =
    fit === 'contain' ? Math.min(breite / iw, hoehe / ih) : Math.max(breite / iw, hoehe / ih);
  const w = iw * faktor;
  const h = ih * faktor;
  ctx.drawImage(bild, (breite - w) / 2, (hoehe - h) / 2, w, h);
}

/** Pfad für die gewählte Avatarform — der anschliessende clip() nutzt ihn. */
function avatarPfad(ctx, { x, y, size, shape, radius }) {
  ctx.beginPath();
  if (shape === 'circle') {
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  } else if (shape === 'rounded') {
    ctx.roundRect(x, y, size, size, Math.min(radius, size / 2));
  } else {
    ctx.rect(x, y, size, size);
  }
  ctx.closePath();
}

/**
 * Setzt die Schrift und verkleinert sie so lange, bis der Text in maxWidth
 * passt. Ohne das liefe ein langer Benutzername über den Bildrand hinaus.
 */
function schriftEinpassen(ctx, text, block) {
  const familie = familieOderStandard(block.font);
  let groesse = block.size;
  ctx.font = `${groesse}px "${familie}"`;
  while (groesse > 12 && ctx.measureText(text).width > block.maxWidth) {
    groesse -= 2;
    ctx.font = `${groesse}px "${familie}"`;
  }
  return groesse;
}

function textZeichnen(ctx, block, werte) {
  if (!block.enabled) return;
  const text = platzhalterErsetzen(block.text, werte);
  if (!text) return;

  schriftEinpassen(ctx, text, block);
  ctx.textAlign = block.align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = block.color;

  if (block.shadow?.enabled) {
    ctx.shadowBlur = block.shadow.blur;
    ctx.shadowColor = block.shadow.color;
  }
  ctx.fillText(text, block.x, block.y);
  // Schatten zurücksetzen, sonst färbt er auf spätere Zeichenoperationen ab.
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

/**
 * Rendert eine Karte.
 *
 * @param {{width:number,height:number,backgroundPath?:string|null,config:object}} vorlage
 * @param {{displayName:string,username?:string,avatarUrl?:string|null}} nutzer
 * @param {object} zusatz weitere Platzhalterwerte, z. B. { guild, role, count }
 * @returns {Promise<{buffer:Buffer, avatarErsatz:boolean, hinweise:string[]}>}
 */
export async function renderCard(vorlage, nutzer, zusatz = {}) {
  ensureFontsRegistered();

  const cfg = normalizeConfig(vorlage.config);
  const breite = vorlage.width;
  const hoehe = vorlage.height;
  const hinweise = [];

  const werte = {
    guild: '',
    role: '',
    count: '',
    ...zusatz,
    // user und tag stammen immer vom Empfänger und dürfen nicht
    // versehentlich aus zusatz überschrieben werden.
    user: nutzer.displayName ?? nutzer.username ?? 'Unbekannt',
    tag: nutzer.username ?? nutzer.displayName ?? 'unbekannt',
  };

  const canvas = createCanvas(breite, hoehe);
  const ctx = canvas.getContext('2d');

  // 1. Grundfarbe — deckt auch die Ränder bei "contain" ab.
  ctx.fillStyle = cfg.background.color;
  ctx.fillRect(0, 0, breite, hoehe);

  // 2. Hintergrundbild, falls hinterlegt.
  if (vorlage.backgroundPath && fs.existsSync(vorlage.backgroundPath)) {
    try {
      const bild = await loadImage(vorlage.backgroundPath);
      hintergrundZeichnen(ctx, bild, breite, hoehe, cfg.background.fit);
    } catch (err) {
      hinweise.push(`Hintergrundbild konnte nicht geladen werden: ${err.message}`);
    }
  }

  // 3. Abdunkelung, damit heller Text auf buntem Hintergrund lesbar bleibt.
  if (cfg.overlay.enabled) {
    ctx.save();
    ctx.globalAlpha = cfg.overlay.opacity;
    ctx.fillStyle = cfg.overlay.color;
    ctx.fillRect(0, 0, breite, hoehe);
    ctx.restore();
  }

  // 4. Avatar — zuerst beschneiden, dann zeichnen, danach den Rand darüber.
  let avatarErsatz = false;
  if (cfg.avatar.enabled) {
    const { bild, ersatz, grund } = await loadAvatar(nutzer.avatarUrl, werte.user);
    avatarErsatz = ersatz;
    if (ersatz && grund) hinweise.push(`Profilbild nicht geladen (${grund}), Platzhalter verwendet.`);

    const a = cfg.avatar;
    ctx.save();
    avatarPfad(ctx, a);
    ctx.clip();
    ctx.drawImage(bild, a.x, a.y, a.size, a.size);
    ctx.restore();

    if (a.border.enabled && a.border.width > 0) {
      ctx.save();
      avatarPfad(ctx, a);
      ctx.lineWidth = a.border.width;
      ctx.strokeStyle = a.border.color;
      ctx.stroke();
      ctx.restore();
    }
  }

  // 5. Texte.
  textZeichnen(ctx, cfg.username, werte);
  textZeichnen(ctx, cfg.subtitle, werte);

  return { buffer: await canvas.encode('png'), avatarErsatz, hinweise };
}

/** Baut aus einem Datenbank-Datensatz das Argument für renderCard(). */
export function vorlageAusDatensatz(datensatz, uploadsDir) {
  return {
    width: datensatz.width,
    height: datensatz.height,
    backgroundPath: datensatz.backgroundFile
      ? path.join(uploadsDir, datensatz.backgroundFile)
      : null,
    config: datensatz.config,
  };
}
