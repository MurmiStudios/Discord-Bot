import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db/index.js';
import { createRepos } from '../src/db/repos/index.js';
import {
  baueAktionsleiste,
  buttonIdAusCustomId,
  customIdFuer,
  komponentenFuerSet,
} from '../src/bot/services/buttons.service.js';
import { pruefeButtonZugriff } from '../src/bot/services/buttonClick.service.js';
import {
  aktionenSchema,
  normalizeAktionen,
  MAX_BUTTONS,
} from '../src/bot/services/buttonActions.schema.js';

const G = '111';
const knopf = (id, extra = {}) => ({
  id,
  label: `B${id}`,
  style: 'primary',
  emoji: '',
  enabled: true,
  ...extra,
});

function frisch() {
  const db = openDatabase(':memory:');
  return { db, repos: createRepos(db) };
}

/* ── Kennung ──────────────────────────────────────────────────────────── */

test('die Kennung überlebt den Weg durch Discord', () => {
  // Buttons in zugestellten Nachrichten leben ewig weiter — nach einem
  // Neustart muss ein Klick allein anhand der Kennung zuzuordnen sein.
  assert.equal(buttonIdAusCustomId(customIdFuer(42)), 42);
});

test('fremde Kennungen werden nicht beansprucht', () => {
  for (const fremd of ['andere:1', 'btn:', 'btn:abc', 'btn:-3', 'btn:0', '', null, undefined, 7]) {
    assert.equal(buttonIdAusCustomId(fremd), null, `beansprucht: ${String(fremd)}`);
  }
});

test('die Kennung bleibt unter Discords Längengrenze', () => {
  assert.ok(customIdFuer(999999999).length <= 100);
});

/* ── Aufbau der Leiste ────────────────────────────────────────────────── */

test('bis zu fünf Buttons ergeben eine Reihe', () => {
  const zeilen = baueAktionsleiste([1, 2, 3, 4, 5].map((i) => knopf(i)));
  assert.equal(zeilen.length, 1);
  assert.equal(zeilen[0].components.length, 5);
});

test('ab dem sechsten Button beginnt eine neue Reihe', () => {
  const zeilen = baueAktionsleiste([1, 2, 3, 4, 5, 6].map((i) => knopf(i)));
  assert.equal(zeilen.length, 2, 'Discord erlaubt nur fünf Buttons je Reihe');
  assert.equal(zeilen[1].components.length, 1);
});

test('mehr als 25 Buttons werden abgeschnitten statt abzustürzen', () => {
  const zeilen = baueAktionsleiste(Array.from({ length: 40 }, (_, i) => knopf(i + 1)));
  assert.equal(zeilen.length, 5, 'höchstens fünf Reihen');
  const gesamt = zeilen.reduce((n, z) => n + z.components.length, 0);
  assert.equal(gesamt, MAX_BUTTONS);
});

test('deaktivierte Buttons erscheinen nicht', () => {
  const zeilen = baueAktionsleiste([knopf(1), knopf(2, { enabled: false }), knopf(3)]);
  assert.equal(zeilen[0].components.length, 2);
});

test('ohne Buttons entsteht keine leere Reihe', () => {
  // Eine leere Komponenten-Zeile würde Discord als ungültig zurückweisen.
  assert.deepEqual(baueAktionsleiste([]), []);
  assert.deepEqual(baueAktionsleiste([knopf(1, { enabled: false })]), []);
});

test('ein ungültiges Emoji lässt den Button trotzdem entstehen', () => {
  const zeilen = baueAktionsleiste([knopf(1, { emoji: 'kein-emoji-sondern-text' })]);
  assert.equal(zeilen.length, 1, 'sonst scheiterte die ganze Nachricht');
});

test('komponentenFuerSet liefert leer bei fehlender oder gelöschter Leiste', () => {
  const { repos } = frisch();
  assert.deepEqual(komponentenFuerSet(repos, G, null), []);
  assert.deepEqual(komponentenFuerSet(repos, G, 9999), []);
});

test('komponentenFuerSet baut die gespeicherte Leiste', () => {
  const { repos } = frisch();
  const set = repos.buttonSets.createSet(G, { name: 'L' });
  repos.buttonSets.createButton(set.id, { label: 'Ja', style: 'success', actions: [] });
  repos.buttonSets.createButton(set.id, { label: 'Nein', style: 'danger', actions: [] });

  const zeilen = komponentenFuerSet(repos, G, set.id);
  assert.equal(zeilen[0].components.length, 2);
  assert.equal(zeilen[0].components[0].toJSON().label, 'Ja');
});

/* ── Zugriff ──────────────────────────────────────────────────────────── */

test('ohne Rollenbeschränkung darf jeder klicken', () => {
  assert.equal(pruefeButtonZugriff(knopf(1, { allowedRoleIds: [] }), []).erlaubt, true);
});

test('mit Rollenbeschränkung zählt nur, wer eine davon hat', () => {
  const b = knopf(1, { allowedRoleIds: ['r1', 'r2'] });
  assert.equal(pruefeButtonZugriff(b, ['r2']).erlaubt, true);
  assert.equal(pruefeButtonZugriff(b, ['r9']).erlaubt, false);
  assert.equal(pruefeButtonZugriff(b, []).erlaubt, false);
});

test('abgewiesene Klicks bekommen einen verständlichen Grund', () => {
  const r = pruefeButtonZugriff(knopf(1, { allowedRoleIds: ['r1'] }), []);
  assert.match(r.grund, /Rolle/);
});

test('deaktivierte und gelöschte Buttons werden abgewiesen', () => {
  assert.equal(pruefeButtonZugriff(knopf(1, { enabled: false, allowedRoleIds: [] }), []).erlaubt, false);
  assert.equal(pruefeButtonZugriff(null, []).erlaubt, false);
  assert.equal(pruefeButtonZugriff(undefined, ['r1']).erlaubt, false);
});

/* ── Einmal-Sperre ────────────────────────────────────────────────────── */

test('die Einmal-Sperre lässt genau einen Klick durch', () => {
  const { repos } = frisch();
  const set = repos.buttonSets.createSet(G, { name: 'L' });
  const b = repos.buttonSets.createButton(set.id, { label: 'X', style: 'primary', oncePerUser: true });

  assert.equal(repos.buttonSets.nutzungVormerken(b.id, 'u1'), true);
  assert.equal(repos.buttonSets.nutzungVormerken(b.id, 'u1'), false, 'zweiter Klick muss scheitern');
  assert.equal(repos.buttonSets.nutzungVormerken(b.id, 'u2'), true, 'anderes Mitglied darf');
});

test('die Sperre lässt sich je Mitglied wieder lösen', () => {
  // Nötig, wenn alle Aktionen fehlschlagen — sonst wäre das Mitglied wegen
  // eines Fehlers dauerhaft ausgesperrt.
  const { repos } = frisch();
  const set = repos.buttonSets.createSet(G, { name: 'L' });
  const b = repos.buttonSets.createButton(set.id, { label: 'X', style: 'primary', oncePerUser: true });

  repos.buttonSets.nutzungVormerken(b.id, 'u1');
  repos.buttonSets.nutzungVormerken(b.id, 'u2');
  repos.buttonSets.nutzungLoesen(b.id, 'u1');

  assert.equal(repos.buttonSets.nutzungVormerken(b.id, 'u1'), true, 'u1 darf wieder');
  assert.equal(repos.buttonSets.nutzungVormerken(b.id, 'u2'), false, 'u2 bleibt gesperrt');
});

test('die Sperre lässt sich für alle zurücksetzen', () => {
  const { repos } = frisch();
  const set = repos.buttonSets.createSet(G, { name: 'L' });
  const b = repos.buttonSets.createButton(set.id, { label: 'X', style: 'primary', oncePerUser: true });

  for (const u of ['u1', 'u2', 'u3']) repos.buttonSets.nutzungVormerken(b.id, u);
  assert.equal(repos.buttonSets.anzahlNutzungen(b.id), 3);
  assert.equal(repos.buttonSets.nutzungenZuruecksetzen(b.id), 3);
  assert.equal(repos.buttonSets.anzahlNutzungen(b.id), 0);
});

/* ── Aktionen ─────────────────────────────────────────────────────────── */

test('alle drei Aktionsarten werden angenommen', () => {
  const r = aktionenSchema.safeParse([
    { typ: 'dm_klicker', text: 'Hallo {user}' },
    { typ: 'dm_person', userId: '123456789012345678', text: 'Info' },
    { typ: 'rolle', modus: 'umschalten', roleId: '987654321098765432' },
  ]);
  assert.equal(r.success, true, JSON.stringify(r.error?.issues));
  assert.equal(r.data.length, 3);
});

test('unbekannte Aktionsarten und kaputte IDs werden abgewiesen', () => {
  assert.equal(aktionenSchema.safeParse([{ typ: 'kanal', channelId: '1' }]).success, false);
  assert.equal(aktionenSchema.safeParse([{ typ: 'rolle', modus: 'geben', roleId: 'abc' }]).success, false);
  assert.equal(aktionenSchema.safeParse([{ typ: 'rolle', modus: 'unsinn', roleId: '123456' }]).success, false);
});

test('kaputtes gespeichertes JSON ergibt eine leere Liste statt eines Absturzes', () => {
  assert.deepEqual(normalizeAktionen(null), []);
  assert.deepEqual(normalizeAktionen('kein Array'), []);
  assert.deepEqual(normalizeAktionen([{ typ: 'gibtsnicht' }]), []);
});

test('die Reihenfolge der Aktionen bleibt erhalten', () => {
  // Sie bestimmt die Ausführungsreihenfolge beim Klick.
  const { repos } = frisch();
  const set = repos.buttonSets.createSet(G, { name: 'L' });
  const actions = [
    { typ: 'rolle', modus: 'geben', roleId: '111111111111111111' },
    { typ: 'dm_klicker', titel: '', text: 'Zweitens', templateId: null },
  ];
  const b = repos.buttonSets.createButton(set.id, { label: 'X', style: 'primary', actions });

  const gelesen = repos.buttonSets.buttonById(b.id).actions;
  assert.equal(gelesen[0].typ, 'rolle');
  assert.equal(gelesen[1].text, 'Zweitens');
});

/* ── Aufräumen ────────────────────────────────────────────────────────── */

test('mit der Leiste verschwinden Buttons und deren Nutzungen', () => {
  const { repos } = frisch();
  const set = repos.buttonSets.createSet(G, { name: 'L' });
  const b = repos.buttonSets.createButton(set.id, { label: 'X', style: 'primary', oncePerUser: true });
  repos.buttonSets.nutzungVormerken(b.id, 'u1');

  repos.buttonSets.deleteSet(G, set.id);

  assert.equal(repos.buttonSets.buttonById(b.id), null);
  assert.equal(repos.buttonSets.anzahlNutzungen(b.id), 0, 'sonst blieben Waisen zurück');
});

test('Leisten eines anderen Servers sind unsichtbar', () => {
  const { repos } = frisch();
  const set = repos.buttonSets.createSet(G, { name: 'L' });
  assert.equal(repos.buttonSets.setById('222', set.id), null);
  assert.equal(repos.buttonSets.alleSets('222').length, 0);
});

test('Leistennamen sind je Server eindeutig', () => {
  const { repos } = frisch();
  repos.buttonSets.createSet(G, { name: 'Gleich' });
  assert.throws(() => repos.buttonSets.createSet(G, { name: 'Gleich' }), /UNIQUE/);
  assert.doesNotThrow(() => repos.buttonSets.createSet('222', { name: 'Gleich' }));
});
