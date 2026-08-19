/**
 * Upload von Hintergrundbildern.
 *
 * Der Dateityp wird über die ersten Bytes bestimmt, NICHT über den vom Browser
 * gemeldeten mimetype oder die Dateiendung — beides ist frei wählbar und daher
 * wertlos als Prüfung. Zusätzlich wird das Bild probeweise dekodiert und die
 * Kantenlänge begrenzt, damit ein winziges, aber extrem grossflächiges Bild
 * nicht den Speicher sprengt.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { loadImage } from '@napi-rs/canvas';

const SIGNATUREN = [
  { endung: '.png', pruefe: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { endung: '.jpg', pruefe: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    endung: '.webp',
    pruefe: (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

export function erkenneBildTyp(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  return SIGNATUREN.find((s) => s.pruefe(buffer))?.endung ?? null;
}

export function baueUpload(config) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxUploadBytes, files: 1 },
    fileFilter: (_req, file, cb) => {
      // Grobfilter; die verbindliche Prüfung passiert nach dem Einlesen.
      if (!/^image\//.test(file.mimetype)) {
        return cb(new Error('Nur Bilddateien sind erlaubt (PNG, JPEG oder WebP).'));
      }
      return cb(null, true);
    },
  });
}

/**
 * Prüft und speichert ein hochgeladenes Bild.
 * @returns {Promise<{ok:true, dateiname:string}|{ok:false, grund:string}>}
 */
export async function speichereHintergrund(datei, config) {
  if (!datei?.buffer) return { ok: false, grund: 'Es wurde keine Datei übermittelt.' };

  const endung = erkenneBildTyp(datei.buffer);
  if (!endung) {
    return {
      ok: false,
      grund: 'Die Datei ist kein gültiges PNG, JPEG oder WebP — der Inhalt passt nicht zum Dateityp.',
    };
  }

  let bild;
  try {
    bild = await loadImage(datei.buffer);
  } catch {
    return { ok: false, grund: 'Das Bild konnte nicht gelesen werden. Ist die Datei beschädigt?' };
  }

  const max = config.MAX_IMAGE_DIMENSION;
  if (bild.width > max || bild.height > max) {
    return {
      ok: false,
      grund: `Das Bild ist zu gross (${bild.width}×${bild.height}). Erlaubt sind höchstens ${max} Pixel je Kante.`,
    };
  }

  // Eigener Dateiname: der vom Browser gelieferte könnte Pfadanteile enthalten.
  const dateiname = `${randomUUID()}${endung}`;
  fs.mkdirSync(config.uploadsDir, { recursive: true });
  fs.writeFileSync(path.join(config.uploadsDir, dateiname), datei.buffer);

  return { ok: true, dateiname, breite: bild.width, hoehe: bild.height };
}

/** Löscht eine Hintergrunddatei; Pfadanteile im Namen werden ignoriert. */
export function loescheHintergrund(dateiname, config) {
  if (!dateiname) return;
  const sicher = path.basename(dateiname);
  const ziel = path.join(config.uploadsDir, sicher);
  fs.rmSync(ziel, { force: true });
}
