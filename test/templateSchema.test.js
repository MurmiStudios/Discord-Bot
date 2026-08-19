import test from 'node:test';
import assert from 'node:assert/strict';
import {
  templateConfigSchema,
  templateInputSchema,
  normalizeConfig,
  DEFAULT_CONFIG,
  MAX_CANVAS,
} from '../src/images/templateSchema.js';

test('Standardkonfiguration füllt alle Blöcke vollständig', () => {
  for (const block of ['background', 'overlay', 'avatar', 'username', 'subtitle']) {
    assert.ok(Object.keys(DEFAULT_CONFIG[block]).length > 0, `${block} ist leer`);
  }
  assert.equal(DEFAULT_CONFIG.avatar.shape, 'circle');
  assert.equal(DEFAULT_CONFIG.username.font, 'Inter Bold');
  assert.equal(DEFAULT_CONFIG.avatar.border.width, 6);
});

test('Teilangaben werden mit Standardwerten ergänzt', () => {
  const cfg = normalizeConfig({ avatar: { size: 120 } });
  assert.equal(cfg.avatar.size, 120, 'angegebener Wert bleibt');
  assert.equal(cfg.avatar.shape, 'circle', 'fehlender Wert kommt aus dem Standard');
  assert.ok(cfg.username.text, 'unberührter Block wird trotzdem befüllt');
});

test('kaputtes gespeichertes JSON fällt auf den Standard zurück', () => {
  assert.deepEqual(normalizeConfig({ avatar: { size: 'keineZahl' } }), DEFAULT_CONFIG);
  assert.deepEqual(normalizeConfig(null), DEFAULT_CONFIG);
  assert.deepEqual(normalizeConfig('kein Objekt'), DEFAULT_CONFIG);
});

test('unbekannte Schlüssel werden entfernt', () => {
  const cfg = templateConfigSchema.parse({ fremd: 'weg', avatar: { size: 100, unsinn: 1 } });
  assert.ok(!('fremd' in cfg));
  assert.ok(!('unsinn' in cfg.avatar));
});

test('Werte ausserhalb des erlaubten Bereichs werden abgelehnt', () => {
  assert.equal(templateConfigSchema.safeParse({ avatar: { size: 5 } }).success, false);
  assert.equal(templateConfigSchema.safeParse({ username: { size: 500 } }).success, false);
  assert.equal(templateConfigSchema.safeParse({ overlay: { opacity: 2 } }).success, false);
});

test('nur Hex-Farben werden akzeptiert', () => {
  assert.equal(templateConfigSchema.safeParse({ background: { color: '#fff' } }).success, true);
  assert.equal(templateConfigSchema.safeParse({ background: { color: 'rot' } }).success, false);
  // Kein Einschleusen fremder CSS-Werte über das Farbfeld.
  assert.equal(
    templateConfigSchema.safeParse({ background: { color: 'url(javascript:alert(1))' } }).success,
    false,
  );
});

test('nur bekannte Schriftfamilien sind erlaubt', () => {
  assert.equal(templateConfigSchema.safeParse({ username: { font: 'Inter Bold' } }).success, true);
  assert.equal(templateConfigSchema.safeParse({ username: { font: 'Comic Sans' } }).success, false);
});

test('Text wird auf 200 Zeichen begrenzt', () => {
  assert.equal(templateConfigSchema.safeParse({ username: { text: 'x'.repeat(201) } }).success, false);
  assert.equal(templateConfigSchema.safeParse({ username: { text: 'x'.repeat(200) } }).success, true);
});

test('Leinwandgrösse ist nach oben und unten begrenzt', () => {
  assert.equal(templateInputSchema.safeParse({ name: 'A', width: 50 }).success, false);
  assert.equal(templateInputSchema.safeParse({ name: 'A', width: MAX_CANVAS + 1 }).success, false);
  assert.equal(templateInputSchema.safeParse({ name: 'A', width: 800, height: 300 }).success, true);
});

test('Vorlagenname darf nicht leer sein', () => {
  assert.equal(templateInputSchema.safeParse({ name: '   ' }).success, false);
  assert.equal(templateInputSchema.safeParse({}).success, false);
});

test('Zahlen aus Formularen kommen als Zeichenkette an und werden gewandelt', () => {
  const cfg = templateConfigSchema.parse({ avatar: { size: '150', x: '42' } });
  assert.equal(cfg.avatar.size, 150);
  assert.equal(cfg.avatar.x, 42);
  assert.equal(typeof cfg.avatar.size, 'number');
});
