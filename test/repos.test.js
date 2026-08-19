import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db/index.js';
import { createRepos } from '../src/db/repos/index.js';
import { migrations } from '../src/db/migrations.js';

const G = '111';
const ANDERER = '222';

function frisch() {
  const db = openDatabase(':memory:');
  return { db, repos: createRepos(db) };
}

test('Migrationen legen alle Tabellen an und setzen user_version', () => {
  const { db } = frisch();
  const tabellen = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map((r) => r.name);

  for (const erwartet of [
    'settings', 'image_templates', 'role_rules', 'role_messages',
    'member_roles', 'send_log', 'sessions',
  ]) {
    assert.ok(tabellen.includes(erwartet), `Tabelle ${erwartet} fehlt`);
  }
  assert.equal(db.pragma('user_version', { simple: true }), migrations.at(-1).id);
});

test('Migrationen laufen nicht doppelt', () => {
  const { db } = frisch();
  const vorher = db.pragma('user_version', { simple: true });
  // Ein zweiter Durchlauf würde an bereits existierenden Tabellen scheitern.
  assert.doesNotThrow(() => openDatabase(':memory:'));
  assert.equal(db.pragma('user_version', { simple: true }), vorher);
});

test('Einstellungen behalten ihren Datentyp', () => {
  const { repos } = frisch();
  repos.settings.set('a.bool', true);
  repos.settings.set('a.zahl', 42);
  repos.settings.set('a.text', 'Hallo');
  repos.settings.set('a.null', null);

  assert.equal(repos.settings.get('a.bool'), true);
  assert.equal(repos.settings.get('a.zahl'), 42);
  assert.equal(repos.settings.get('a.text'), 'Hallo');
  assert.equal(repos.settings.get('a.null'), null);
  assert.equal(repos.settings.get('gibtsnicht', 'ersatz'), 'ersatz');
});

test('setMany schreibt mehrere Werte auf einmal', () => {
  const { repos } = frisch();
  repos.settings.setMany({ 'w.enabled': true, 'w.title': 'Hallo', 'w.template_id': 7 });
  assert.equal(repos.settings.get('w.enabled'), true);
  assert.equal(repos.settings.get('w.title'), 'Hallo');
  assert.equal(repos.settings.get('w.template_id'), 7);
});

test('Rollen-Momentaufnahme wird sortiert und entdoppelt gespeichert', () => {
  const { repos } = frisch();
  repos.memberRoles.put(G, 'u1', ['r3', 'r1', 'r1', 'r2']);
  assert.deepEqual(repos.memberRoles.get(G, 'u1'), ['r1', 'r2', 'r3']);
});

test('unbekanntes Mitglied liefert null, nicht ein leeres Feld', () => {
  const { repos } = frisch();
  // Der Unterschied ist wesentlich: null heisst "noch nie gesehen" und darf
  // keine Regel auslösen, [] hiesse "hat nachweislich keine Rolle".
  assert.equal(repos.memberRoles.get(G, 'unbekannt'), null);
  repos.memberRoles.put(G, 'u2', []);
  assert.deepEqual(repos.memberRoles.get(G, 'u2'), []);
});

test('Momentaufnahmen sind je Server getrennt', () => {
  const { repos } = frisch();
  repos.memberRoles.put(G, 'u1', ['a']);
  repos.memberRoles.put(ANDERER, 'u1', ['b']);
  assert.deepEqual(repos.memberRoles.get(G, 'u1'), ['a']);
  assert.deepEqual(repos.memberRoles.get(ANDERER, 'u1'), ['b']);
});

test('putMany befüllt viele Mitglieder auf einmal', () => {
  const { repos } = frisch();
  repos.memberRoles.putMany(G, [
    { userId: 'a', roleIds: ['r1'] },
    { userId: 'b', roleIds: ['r1', 'r2'] },
    { userId: 'c', roleIds: [] },
  ]);
  assert.equal(repos.memberRoles.count(G), 3);
  assert.deepEqual(repos.memberRoles.get(G, 'b'), ['r1', 'r2']);
});

test('Rollenregeln: anlegen, ändern, umschalten, löschen', () => {
  const { repos } = frisch();
  const regel = repos.roleRules.create(G, {
    triggerRoleId: 'B',
    removeRoleIds: ['A', 'A', 'C'],
    note: 'Test',
  });

  assert.deepEqual(regel.removeRoleIds, ['A', 'C'], 'Dopplungen werden entfernt');
  assert.equal(regel.enabled, true);

  repos.roleRules.setEnabled(G, regel.id, false);
  assert.equal(repos.roleRules.byId(G, regel.id).enabled, false);
  assert.equal(repos.roleRules.allEnabled(G).length, 0, 'deaktivierte Regeln sind ausgeblendet');

  repos.roleRules.update(G, regel.id, { triggerRoleId: 'X', removeRoleIds: ['Y'], enabled: true, note: '' });
  const geaendert = repos.roleRules.byId(G, regel.id);
  assert.equal(geaendert.triggerRoleId, 'X');
  assert.deepEqual(geaendert.removeRoleIds, ['Y']);

  repos.roleRules.delete(G, regel.id);
  assert.equal(repos.roleRules.byId(G, regel.id), null);
});

test('Regeln eines anderen Servers sind unsichtbar', () => {
  const { repos } = frisch();
  const regel = repos.roleRules.create(G, { triggerRoleId: 'B', removeRoleIds: ['A'] });
  assert.equal(repos.roleRules.byId(ANDERER, regel.id), null);
  assert.equal(repos.roleRules.all(ANDERER).length, 0);
});

test('Bildvorlagen speichern ihr Layout verlustfrei', () => {
  const { repos } = frisch();
  const config = { avatar: { x: 10, shape: 'rounded' }, username: { text: '{user}' } };
  const v = repos.templates.create(G, {
    name: 'Test', kind: 'welcome', width: 800, height: 300, config,
  });

  assert.deepEqual(repos.templates.byId(G, v.id).config, config);
  assert.equal(repos.templates.byKind(G, 'welcome').length, 1);
  assert.equal(repos.templates.byKind(G, 'role').length, 0);
});

test('Vorlagennamen sind je Server eindeutig', () => {
  const { repos } = frisch();
  const daten = { name: 'Gleich', kind: 'generic', width: 800, height: 300, config: {} };
  repos.templates.create(G, daten);
  assert.throws(() => repos.templates.create(G, daten), /UNIQUE/);
  // Auf einem anderen Server ist derselbe Name in Ordnung.
  assert.doesNotThrow(() => repos.templates.create(ANDERER, daten));
});

test('Rollen-Nachricht findet sich über die automatische Zustellung', () => {
  const { repos } = frisch();
  repos.roleMessages.create(G, { roleId: 'R', body: 'Hallo', autoSend: true, enabled: true });
  repos.roleMessages.create(G, { roleId: 'R', body: 'Aus', autoSend: true, enabled: false });
  repos.roleMessages.create(G, { roleId: 'R', body: 'Manuell', autoSend: false, enabled: true });

  const auto = repos.roleMessages.autoForRole(G, 'R');
  assert.equal(auto.length, 1, 'nur aktive mit autoSend');
  assert.equal(auto[0].body, 'Hallo');
  assert.equal(repos.roleMessages.autoForRole(G, 'ANDERE').length, 0);
});

test('gelöschte Vorlage setzt die Verknüpfung auf null statt zu löschen', () => {
  const { repos } = frisch();
  const v = repos.templates.create(G, { name: 'V', kind: 'role', width: 800, height: 300, config: {} });
  const n = repos.roleMessages.create(G, { roleId: 'R', body: 'Text', templateId: v.id });

  repos.templates.delete(G, v.id);

  const danach = repos.roleMessages.byId(G, n.id);
  assert.ok(danach, 'die Nachricht bleibt erhalten');
  assert.equal(danach.templateId, null, 'nur die Verknüpfung fällt weg');
});

test('Protokoll kürzt überlange Texte', () => {
  const { repos } = frisch();
  repos.log.add(G, { kind: 'dm', status: 'failed', detail: 'x'.repeat(900), payloadExcerpt: 'y'.repeat(900) });
  const e = repos.log.recent(G)[0];
  assert.equal(e.detail.length, 500);
  assert.equal(e.payloadExcerpt.length, 200);
});

test('Protokoll filtert nach Art und zählt Status', () => {
  const { repos } = frisch();
  repos.log.add(G, { kind: 'dm', status: 'ok' });
  repos.log.add(G, { kind: 'dm', status: 'failed', errorCode: 50007 });
  repos.log.add(G, { kind: 'rule_applied', status: 'skipped' });

  assert.equal(repos.log.count(G), 3);
  assert.equal(repos.log.count(G, 'dm'), 2);
  assert.equal(repos.log.recent(G, { kind: 'rule_applied' }).length, 1);
  assert.deepEqual(repos.log.statusSince(G, 0), { ok: 1, failed: 1, skipped: 1 });
});

test('Protokoll liefert die neuesten Einträge zuerst und lässt sich blättern', () => {
  const { repos } = frisch();
  for (let i = 0; i < 5; i += 1) repos.log.add(G, { kind: 'dm', status: 'ok', detail: `Nr ${i}` });

  const erste = repos.log.recent(G, { limit: 2 });
  assert.equal(erste.length, 2);
  assert.equal(erste[0].detail, 'Nr 4', 'neuester zuerst');

  const zweite = repos.log.recent(G, { limit: 2, offset: 2 });
  assert.equal(zweite[0].detail, 'Nr 2');
});
