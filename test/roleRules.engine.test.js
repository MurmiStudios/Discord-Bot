import test from 'node:test';
import assert from 'node:assert/strict';
import { planRemovals, diffRollen } from '../src/bot/services/roleRules.engine.js';

const regel = (id, trigger, entfernen, enabled = true) => ({
  id,
  triggerRoleId: trigger,
  removeRoleIds: entfernen,
  enabled,
});

test('einzelne Regel: B vergeben entfernt A', () => {
  const { entfernen, gruende } = planRemovals(['B'], ['B', 'A'], [regel(1, 'B', ['A'])]);
  assert.deepEqual(entfernen, ['A']);
  assert.deepEqual(gruende, [{ regelId: 1, trigger: 'B', rolle: 'A' }]);
});

test('eine Regel kann mehrere Rollen entfernen', () => {
  const { entfernen } = planRemovals(['B'], ['B', 'A', 'C'], [regel(1, 'B', ['A', 'C'])]);
  assert.deepEqual(entfernen.sort(), ['A', 'C']);
});

test('mehrere Regeln greifen gleichzeitig, ohne Dopplung', () => {
  const { entfernen } = planRemovals(
    ['B', 'C'],
    ['B', 'C', 'A', 'D'],
    [regel(1, 'B', ['A']), regel(2, 'C', ['A', 'D'])],
  );
  assert.deepEqual(entfernen.sort(), ['A', 'D']);
  assert.equal(entfernen.filter((r) => r === 'A').length, 1, 'A darf nur einmal vorkommen');
});

test('Rolle, die das Mitglied nicht hat, wird nicht angefasst', () => {
  const { entfernen } = planRemovals(['B'], ['B'], [regel(1, 'B', ['A'])]);
  assert.deepEqual(entfernen, [], 'spart einen sinnlosen API-Aufruf');
});

test('eine gerade vergebene Rolle wird nie entfernt', () => {
  // Selbstbezügliche Regel: "B entfernt B".
  const { entfernen } = planRemovals(['B'], ['B'], [regel(1, 'B', ['B'])]);
  assert.deepEqual(entfernen, []);
});

test('zwei gleichzeitig vergebene Rollen heben sich nicht gegenseitig auf', () => {
  const { entfernen } = planRemovals(
    ['A', 'B'],
    ['A', 'B'],
    [regel(1, 'A', ['B']), regel(2, 'B', ['A'])],
  );
  assert.deepEqual(entfernen, [], 'sonst verlöre das Mitglied beide Rollen');
});

test('widersprüchliche Regeln konvergieren statt zu schwingen', () => {
  // A ist schon da, B kommt neu dazu. Regeln: A entfernt B, B entfernt A.
  const erst = planRemovals(['B'], ['A', 'B'], [regel(1, 'A', ['B']), regel(2, 'B', ['A'])]);
  assert.deepEqual(erst.entfernen, ['A'], 'nur der neue Trigger B greift');

  // Unser Entfernen löst ein Folgeereignis aus: nichts wurde hinzugefügt.
  const danach = planRemovals([], ['B'], [regel(1, 'A', ['B']), regel(2, 'B', ['A'])]);
  assert.deepEqual(danach.entfernen, [], 'Schleifenfreiheit: das Folgeereignis plant nichts');
});

test('reines Entfern-Ereignis plant nichts — der Schleifenbeweis', () => {
  const { entfernen } = planRemovals([], ['A', 'C'], [regel(1, 'B', ['A'])]);
  assert.deepEqual(entfernen, []);
});

test('deaktivierte Regeln werden übersprungen', () => {
  const { entfernen } = planRemovals(['B'], ['B', 'A'], [regel(1, 'B', ['A'], false)]);
  assert.deepEqual(entfernen, []);
});

test('Regeln für nicht betroffene Trigger bleiben wirkungslos', () => {
  const { entfernen } = planRemovals(['X'], ['X', 'A'], [regel(1, 'B', ['A'])]);
  assert.deepEqual(entfernen, []);
});

test('leere Regelliste ist unkritisch', () => {
  const { entfernen } = planRemovals(['B'], ['B', 'A'], []);
  assert.deepEqual(entfernen, []);
});

test('diffRollen meldet die Erstsichtung', () => {
  const d = diffRollen(null, ['A', 'B']);
  assert.equal(d.erstsichtung, true);
  assert.deepEqual(d.hinzugefuegt, [], 'bei der Erstsichtung darf nichts als "neu" gelten');
});

test('diffRollen erkennt Hinzufügen und Entfernen', () => {
  const d = diffRollen(['A', 'B'], ['B', 'C']);
  assert.equal(d.erstsichtung, false);
  assert.deepEqual(d.hinzugefuegt, ['C']);
  assert.deepEqual(d.entfernt, ['A']);
  assert.equal(d.geaendert, true);
});

test('diffRollen meldet unveränderte Rollen als nicht geändert', () => {
  // Wichtig fürs Schreibaufkommen: guildMemberUpdate feuert auch bei
  // Namens- und Avataränderungen.
  const d = diffRollen(['A', 'B'], ['B', 'A']);
  assert.equal(d.geaendert, false);
  assert.deepEqual(d.hinzugefuegt, []);
  assert.deepEqual(d.entfernt, []);
});
