import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { erkenneBildTyp, speichereHintergrund, loescheHintergrund } from '../src/web/middleware/upload.js';

const PNG_KOPF = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function testConfig() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-test-'));
  return { uploadsDir: dir, MAX_IMAGE_DIMENSION: 4000, maxUploadBytes: 8 * 1024 * 1024 };
}

async function pngPuffer(breite, hoehe) {
  const c = createCanvas(breite, hoehe);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#345678';
  ctx.fillRect(0, 0, breite, hoehe);
  return c.encode('png');
}

test('erkennt die unterstützten Bildformate an den ersten Bytes', () => {
  assert.equal(erkenneBildTyp(Buffer.concat([PNG_KOPF, Buffer.alloc(8)])), '.png');
  assert.equal(erkenneBildTyp(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(12)])), '.jpg');
  assert.equal(
    erkenneBildTyp(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(4)])),
    '.webp',
  );
});

test('weist alles ab, was kein Bild ist', () => {
  assert.equal(erkenneBildTyp(Buffer.from('Das ist nur Text und kein Bild.')), null);
  assert.equal(erkenneBildTyp(Buffer.alloc(20)), null);
  assert.equal(erkenneBildTyp(Buffer.from([0x89])), null, 'zu kurz für eine Signatur');
  assert.equal(erkenneBildTyp(null), null);
  assert.equal(erkenneBildTyp('kein Puffer'), null);
});

test('als PNG benannte Textdatei wird abgelehnt', async () => {
  const config = testConfig();
  // Genau der Fall, den eine Prüfung auf mimetype oder Dateiendung durchliesse.
  const res = await speichereHintergrund(
    { buffer: Buffer.from('Ich behaupte, ein PNG zu sein.'), mimetype: 'image/png', originalname: 'bild.png' },
    config,
  );
  assert.equal(res.ok, false);
  assert.match(res.grund, /kein gültiges PNG/);
});

test('zu grosses Bild wird abgelehnt', async () => {
  const config = { ...testConfig(), MAX_IMAGE_DIMENSION: 500 };
  const res = await speichereHintergrund({ buffer: await pngPuffer(800, 300) }, config);
  assert.equal(res.ok, false);
  assert.match(res.grund, /zu gross/);
  assert.match(res.grund, /500 Pixel/, 'das Limit gehört in die Meldung');
});

test('fehlende Datei wird sauber abgewiesen', async () => {
  const res = await speichereHintergrund(null, testConfig());
  assert.equal(res.ok, false);
});

test('gültiges Bild wird unter einem erzeugten Namen gespeichert', async () => {
  const config = testConfig();
  const res = await speichereHintergrund(
    { buffer: await pngPuffer(800, 300), originalname: '../../boese.png' },
    config,
  );

  assert.equal(res.ok, true);
  assert.equal(res.breite, 800);
  assert.equal(res.hoehe, 300);
  // Der vom Browser gelieferte Name darf niemals übernommen werden.
  assert.ok(!res.dateiname.includes('boese'));
  assert.ok(!res.dateiname.includes('..'));
  assert.match(res.dateiname, /^[0-9a-f-]{36}\.png$/);
  assert.ok(fs.existsSync(path.join(config.uploadsDir, res.dateiname)));
});

test('Löschen bricht nicht aus dem Upload-Verzeichnis aus', async () => {
  const config = testConfig();
  const draussen = path.join(config.uploadsDir, '..', 'nicht-loeschen.txt');
  fs.writeFileSync(draussen, 'wichtig');

  loescheHintergrund('../nicht-loeschen.txt', config);

  assert.ok(fs.existsSync(draussen), 'Datei ausserhalb darf nicht gelöscht werden');
  fs.rmSync(draussen, { force: true });
});

test('Löschen einer nicht vorhandenen Datei wirft nicht', () => {
  assert.doesNotThrow(() => loescheHintergrund('gibtsnicht.png', testConfig()));
  assert.doesNotThrow(() => loescheHintergrund(null, testConfig()));
});
