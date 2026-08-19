/**
 * Registriert die mitgelieferten Schriften einmalig bei Canvas.
 *
 * Das Mitliefern ist Absicht: schlanke Container haben oft gar keine
 * Schriften installiert. Eine nicht registrierte Familie fällt ohne Fehler auf
 * eine Ersatzschrift zurück — das Bild wird dann still zu einer Reihe von
 * Kästchen, was beim Testen leicht übersehen wird.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GlobalFonts } from '@napi-rs/canvas';

const hier = path.dirname(fileURLToPath(import.meta.url));
const fontDir = path.resolve(hier, '../../assets/fonts');

export const FONT_FAMILIEN = ['Inter Regular', 'Inter Bold'];

const dateien = [
  { datei: 'Inter-Regular.ttf', familie: 'Inter Regular' },
  { datei: 'Inter-Bold.ttf', familie: 'Inter Bold' },
];

let registriert = false;

export function ensureFontsRegistered() {
  if (registriert) return;
  for (const { datei, familie } of dateien) {
    const p = path.join(fontDir, datei);
    if (!fs.existsSync(p)) {
      throw new Error(
        `Schriftdatei fehlt: ${p}\n` +
          'Ohne sie werden alle Texte als Kästchen gerendert. ' +
          'Die Dateien gehören ins Repository unter assets/fonts/.',
      );
    }
    GlobalFonts.registerFromPath(p, familie);
  }
  registriert = true;
}

/** Fällt auf "Inter Regular" zurück, falls eine unbekannte Familie gespeichert ist. */
export function familieOderStandard(name) {
  return FONT_FAMILIEN.includes(name) ? name : 'Inter Regular';
}
