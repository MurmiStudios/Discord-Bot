/**
 * Rendert Beispielkarten nach data/generated/ — ganz ohne Discord-Token.
 *
 * Damit lässt sich die Bildpipeline prüfen, bevor irgendetwas mit Discord
 * verbunden ist:   node scripts/render-sample.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { renderCard } from '../src/images/renderer.js';
import { DEFAULT_TEMPLATE, normalizeConfig } from '../src/images/templateSchema.js';

const ausgabe = path.resolve('data/generated');
fs.mkdirSync(ausgabe, { recursive: true });

const faelle = [
  {
    datei: 'willkommen.png',
    vorlage: DEFAULT_TEMPLATE,
    nutzer: { displayName: 'Anna Müller', username: 'anna_m' },
    zusatz: { guild: 'Mein Testserver', count: 128 },
  },
  {
    datei: 'rolle.png',
    vorlage: {
      ...DEFAULT_TEMPLATE,
      config: normalizeConfig({
        background: { color: '#2b2d31' },
        avatar: { shape: 'rounded', border: { color: '#57f287' } },
        username: { text: '{user}', color: '#ffffff' },
        subtitle: { text: 'Du hast jetzt die Rolle {role}', color: '#57f287' },
      }),
    },
    nutzer: { displayName: 'Bob', username: 'bob' },
    zusatz: { guild: 'Mein Testserver', role: 'Mitglied' },
  },
  {
    datei: 'langer-name.png',
    vorlage: DEFAULT_TEMPLATE,
    // Härtefall: prüft, dass die Verkleinerungsschleife greift.
    nutzer: { displayName: 'Maximilian Alexander von Habsburg-Lothringen III.', username: 'max' },
    zusatz: { guild: 'Ein Server mit sehr langem Namen' },
  },
  {
    datei: 'quadratisch.png',
    vorlage: {
      ...DEFAULT_TEMPLATE,
      width: 600,
      height: 600,
      config: normalizeConfig({
        background: { color: '#5865f2' },
        avatar: { x: 200, y: 120, size: 200, shape: 'circle' },
        username: { x: 300, y: 380, align: 'center', maxWidth: 520, size: 48 },
        subtitle: { x: 300, y: 440, align: 'center', maxWidth: 520, text: 'Willkommen!' },
      }),
    },
    nutzer: { displayName: 'Chris', username: 'chris' },
    zusatz: { guild: 'Testserver' },
  },
];

let fehler = 0;
for (const f of faelle) {
  try {
    const { buffer, avatarErsatz, hinweise } = await renderCard(
      { ...f.vorlage, backgroundPath: f.vorlage.backgroundPath ?? null },
      f.nutzer,
      f.zusatz,
    );
    const ziel = path.join(ausgabe, f.datei);
    fs.writeFileSync(ziel, buffer);
    const istPng = buffer.subarray(1, 4).toString() === 'PNG';
    console.log(
      `  ${istPng ? 'ok' : 'FEHLER'}  ${f.datei.padEnd(18)} ${String(buffer.length).padStart(7)} Bytes` +
        `${avatarErsatz ? '  (Platzhalter-Avatar)' : ''}`,
    );
    for (const h of hinweise) console.log(`        Hinweis: ${h}`);
    if (!istPng) fehler += 1;
  } catch (err) {
    console.error(`  FEHLER  ${f.datei}: ${err.message}`);
    fehler += 1;
  }
}

console.log(`\n  Ausgabe in ${ausgabe}`);
process.exit(fehler ? 1 : 0);
