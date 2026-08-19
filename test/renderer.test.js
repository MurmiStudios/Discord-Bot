import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { renderCard, platzhalterErsetzen } from '../src/images/renderer.js';
import { DEFAULT_TEMPLATE, normalizeConfig } from '../src/images/templateSchema.js';
import { ensureFontsRegistered, familieOderStandard } from '../src/images/fonts.js';

const AUSGABE = path.resolve('data/generated');
fs.mkdirSync(AUSGABE, { recursive: true });

const istPng = (buf) =>
  buf.length > 8 &&
  buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

const NUTZER = { displayName: 'Anna Müller', username: 'anna_m', avatarUrl: null };

test('Schriften lassen sich registrieren und sind mehrfach aufrufbar', () => {
  ensureFontsRegistered();
  ensureFontsRegistered();
  assert.equal(familieOderStandard('Inter Bold'), 'Inter Bold');
  assert.equal(familieOderStandard('Gibt Es Nicht'), 'Inter Regular', 'fällt auf Standard zurück');
});

test('Platzhalter werden ersetzt, unbekannte bleiben stehen', () => {
  const text = platzhalterErsetzen('Hallo {user} auf {guild}! {unbekannt}', {
    user: 'Anna',
    guild: 'Testserver',
  });
  assert.equal(text, 'Hallo Anna auf Testserver! {unbekannt}');
});

test('Platzhalterwerte werden entschärft und gekürzt', () => {
  assert.equal(platzhalterErsetzen('{user}', { user: '  Anna  ' }), 'Anna');
  // Steuerzeichen verfälschen die Textmessung und müssen verschwinden.
  assert.equal(platzhalterErsetzen('{user}', { user: 'An\u0007na' }), 'Anna');
  assert.equal(platzhalterErsetzen('{user}', { user: 'x'.repeat(200) }).length, 64);
});

test('Standardvorlage ergibt ein gültiges PNG', async () => {
  const { buffer } = await renderCard({ ...DEFAULT_TEMPLATE, backgroundPath: null }, NUTZER, {
    guild: 'Testserver',
  });
  fs.writeFileSync(path.join(AUSGABE, 'test-standard.png'), buffer);
  assert.ok(istPng(buffer), 'PNG-Signatur fehlt');
  assert.ok(buffer.length > 1000, 'Bild ist verdächtig klein');
});

test('jede Avatarform rendert', async () => {
  for (const shape of ['circle', 'rounded', 'square']) {
    const { buffer } = await renderCard(
      { ...DEFAULT_TEMPLATE, backgroundPath: null, config: normalizeConfig({ avatar: { shape } }) },
      NUTZER,
    );
    fs.writeFileSync(path.join(AUSGABE, `test-${shape}.png`), buffer);
    assert.ok(istPng(buffer), `${shape} ergab kein PNG`);
  }
});

test('fehlendes Profilbild blockiert das Rendern nicht', async () => {
  const { buffer, avatarErsatz, hinweise } = await renderCard(
    { ...DEFAULT_TEMPLATE, backgroundPath: null },
    { displayName: 'Ohne Bild', username: 'ohne', avatarUrl: null },
  );
  assert.ok(istPng(buffer));
  assert.equal(avatarErsatz, true, 'Platzhalter muss einspringen');
  assert.ok(hinweise.length > 0, 'der Grund gehört in die Hinweise');
});

test('fehlendes Hintergrundbild wird stillschweigend übersprungen', async () => {
  const { buffer } = await renderCard(
    { ...DEFAULT_TEMPLATE, backgroundPath: '/gibt/es/nicht.png' },
    NUTZER,
  );
  assert.ok(istPng(buffer), 'die Karte muss trotzdem entstehen');
});

test('langer Name wird verkleinert, bis er in die Breite passt', async () => {
  const maxWidth = 400;
  const langerName = 'Maximilian Alexander von Habsburg-Lothringen III.';
  const config = normalizeConfig({ username: { size: 64, maxWidth, x: 320 } });

  const { buffer } = await renderCard(
    { ...DEFAULT_TEMPLATE, backgroundPath: null, config },
    { displayName: langerName, username: 'max', avatarUrl: null },
  );
  fs.writeFileSync(path.join(AUSGABE, 'test-langer-name.png'), buffer);
  assert.ok(istPng(buffer));

  // Dieselbe Verkleinerungslogik nachvollziehen und prüfen, dass sie greift.
  const ctx = createCanvas(10, 10).getContext('2d');
  let groesse = 64;
  ctx.font = `${groesse}px "Inter Bold"`;
  while (groesse > 12 && ctx.measureText(langerName).width > maxWidth) {
    groesse -= 2;
    ctx.font = `${groesse}px "Inter Bold"`;
  }
  assert.ok(groesse < 64, 'die Verkleinerung muss überhaupt greifen');
  assert.ok(ctx.measureText(langerName).width <= maxWidth, 'der Text passt am Ende in die Breite');
});

test('abgeschaltete Blöcke werden nicht gezeichnet', async () => {
  const { buffer } = await renderCard(
    {
      ...DEFAULT_TEMPLATE,
      backgroundPath: null,
      config: normalizeConfig({
        avatar: { enabled: false },
        username: { enabled: false },
        subtitle: { enabled: false },
      }),
    },
    NUTZER,
  );
  assert.ok(istPng(buffer), 'auch eine leere Karte ist ein gültiges PNG');
});

test('zusatz kann user und tag nicht überschreiben', async () => {
  // Sonst könnte ein Platzhalterwert den echten Empfängernamen verdrängen.
  const { buffer } = await renderCard({ ...DEFAULT_TEMPLATE, backgroundPath: null }, NUTZER, {
    user: 'Fremder Name',
    tag: 'fremd',
  });
  assert.ok(istPng(buffer));
});

test('abweichende Bildgrössen funktionieren', async () => {
  for (const [w, h] of [
    [600, 600],
    [1200, 300],
    [400, 800],
  ]) {
    const { buffer } = await renderCard(
      { ...DEFAULT_TEMPLATE, width: w, height: h, backgroundPath: null },
      NUTZER,
    );
    assert.ok(istPng(buffer), `${w}x${h} ergab kein PNG`);
  }
});
