import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db/index.js';
import { createRepos } from '../src/db/repos/index.js';
import { verarbeiteRollenAenderung } from '../src/bot/services/roleRules.apply.js';

const GUILD = '111';
const config = { GUILD_ID: GUILD };

/** Baut ein Mitglied nach, das sich wie discord.js verhält — inklusive Hierarchie. */
function baueMitglied({ userId = 'u1', rollen = [], botPosition = 10, botDarfRollen = true } = {}) {
  const entfernt = [];
  const rollenCache = new Map();

  const rolle = (id, { position = 1, managed = false, name = id } = {}) => ({
    id,
    name,
    managed,
    position,
    comparePositionTo(andere) {
      return position - andere.position;
    },
  });

  const alleRollen = new Map([
    ['A', rolle('A')],
    ['B', rolle('B')],
    ['C', rolle('C')],
    ['HOCH', rolle('HOCH', { position: 99 })],
    ['BOT_ROLLE', rolle('BOT_ROLLE', { position: botPosition })],
    ['INTEGRATION', rolle('INTEGRATION', { managed: true })],
  ]);

  for (const id of rollen) rollenCache.set(id, alleRollen.get(id));

  const guild = {
    id: GUILD,
    roles: { cache: alleRollen },
    members: {
      me: {
        permissions: { has: () => botDarfRollen },
        roles: { highest: alleRollen.get('BOT_ROLLE') },
      },
    },
  };

  return {
    member: {
      id: userId,
      guild,
      roles: {
        cache: rollenCache,
        async remove(ids) {
          entfernt.push(...ids);
          for (const id of ids) rollenCache.delete(id);
        },
      },
    },
    entfernt,
  };
}

function aufbau() {
  const db = openDatabase(':memory:');
  return { repos: createRepos(db) };
}

test('Erstsichtung merkt sich die Rollen und handelt nicht', async () => {
  const { repos } = aufbau();
  repos.roleRules.create(GUILD, { triggerRoleId: 'B', removeRoleIds: ['A'] });
  const { member, entfernt } = baueMitglied({ rollen: ['A', 'B'] });

  const r = await verarbeiteRollenAenderung(member, { repos, config });

  assert.equal(r.aktion, 'erstsichtung');
  assert.deepEqual(entfernt, [], 'bei der Erstsichtung darf nichts entfernt werden');
  assert.deepEqual(repos.memberRoles.get(GUILD, 'u1'), ['A', 'B']);
});

test('B vergeben entfernt A', async () => {
  const { repos } = aufbau();
  repos.roleRules.create(GUILD, { triggerRoleId: 'B', removeRoleIds: ['A'] });
  repos.memberRoles.put(GUILD, 'u1', ['A']);
  const { member, entfernt } = baueMitglied({ rollen: ['A', 'B'] });

  const r = await verarbeiteRollenAenderung(member, { repos, config });

  assert.equal(r.aktion, 'angewandt');
  assert.deepEqual(entfernt, ['A']);
  assert.deepEqual(repos.memberRoles.get(GUILD, 'u1'), ['B'], 'Momentaufnahme wird nachgezogen');
});

test('das Folgeereignis nach unserem Entfernen tut nichts — Schleifenbeweis', async () => {
  const { repos } = aufbau();
  repos.roleRules.create(GUILD, { triggerRoleId: 'B', removeRoleIds: ['A'] });
  repos.roleRules.create(GUILD, { triggerRoleId: 'A', removeRoleIds: ['B'] });
  repos.memberRoles.put(GUILD, 'u1', ['A', 'B']);

  // Zustand nach unserem eigenen Entfernen: A ist weg, nichts kam hinzu.
  const { member, entfernt } = baueMitglied({ rollen: ['B'] });
  const r = await verarbeiteRollenAenderung(member, { repos, config });

  assert.equal(r.aktion, 'nichts-hinzugefuegt');
  assert.deepEqual(entfernt, [], 'sonst würde die Regel endlos hin und her schwingen');
});

test('Namensänderung ohne Rollenwechsel löst nichts aus', async () => {
  const { repos } = aufbau();
  repos.roleRules.create(GUILD, { triggerRoleId: 'B', removeRoleIds: ['A'] });
  repos.memberRoles.put(GUILD, 'u1', ['A', 'B']);
  const { member, entfernt } = baueMitglied({ rollen: ['A', 'B'] });

  const r = await verarbeiteRollenAenderung(member, { repos, config });

  assert.equal(r.aktion, 'nichts-hinzugefuegt');
  assert.deepEqual(entfernt, []);
});

test('Rolle über der Bot-Rolle wird übersprungen statt zu scheitern', async () => {
  const { repos } = aufbau();
  repos.roleRules.create(GUILD, { triggerRoleId: 'B', removeRoleIds: ['HOCH'] });
  repos.memberRoles.put(GUILD, 'u1', ['HOCH']);
  const { member, entfernt } = baueMitglied({ rollen: ['HOCH', 'B'] });

  const r = await verarbeiteRollenAenderung(member, { repos, config });

  assert.deepEqual(entfernt, []);
  assert.equal(r.uebersprungen.length, 1);
  assert.match(r.uebersprungen[0].grund, /über der Rolle des Bots/);

  const protokoll = repos.log.recent(GUILD);
  assert.equal(protokoll[0].status, 'skipped', 'der Grund gehört ins Protokoll');
});

test('von einer Integration verwaltete Rolle wird nie entfernt', async () => {
  const { repos } = aufbau();
  repos.roleRules.create(GUILD, { triggerRoleId: 'B', removeRoleIds: ['INTEGRATION'] });
  repos.memberRoles.put(GUILD, 'u1', ['INTEGRATION']);
  const { member, entfernt } = baueMitglied({ rollen: ['INTEGRATION', 'B'] });

  const r = await verarbeiteRollenAenderung(member, { repos, config });

  assert.deepEqual(entfernt, []);
  assert.match(r.uebersprungen[0].grund, /Integration/);
});

test('fehlende Berechtigung führt zu einem Hinweis, nicht zu einem Absturz', async () => {
  const { repos } = aufbau();
  repos.roleRules.create(GUILD, { triggerRoleId: 'B', removeRoleIds: ['A'] });
  repos.memberRoles.put(GUILD, 'u1', ['A']);
  const { member, entfernt } = baueMitglied({ rollen: ['A', 'B'], botDarfRollen: false });

  const r = await verarbeiteRollenAenderung(member, { repos, config });

  assert.deepEqual(entfernt, []);
  assert.match(r.uebersprungen[0].grund, /Rollen verwalten/);
});

test('mehrere zu entfernende Rollen gehen in einem einzigen Aufruf raus', async () => {
  const { repos } = aufbau();
  repos.roleRules.create(GUILD, { triggerRoleId: 'B', removeRoleIds: ['A', 'C'] });
  repos.memberRoles.put(GUILD, 'u1', ['A', 'C']);

  const { member } = baueMitglied({ rollen: ['A', 'C', 'B'] });
  let aufrufe = 0;
  const originalRemove = member.roles.remove.bind(member.roles);
  member.roles.remove = async (ids, grund) => {
    aufrufe += 1;
    assert.ok(Array.isArray(ids), 'die IDs müssen gebündelt übergeben werden');
    assert.match(grund, /Rollenregel/, 'die Begründung landet im Discord-Audit-Log');
    return originalRemove(ids, grund);
  };

  await verarbeiteRollenAenderung(member, { repos, config });
  assert.equal(aufrufe, 1, 'ein Aufruf statt einer je Rolle');
});

test('Ereignisse eines fremden Servers werden ignoriert', async () => {
  const { repos } = aufbau();
  const { member, entfernt } = baueMitglied({ rollen: ['A', 'B'] });
  member.guild.id = 'fremd';

  const r = await verarbeiteRollenAenderung(member, { repos, config });

  assert.equal(r.aktion, 'fremder-server');
  assert.deepEqual(entfernt, []);
});

test('deaktivierte Regel greift nicht', async () => {
  const { repos } = aufbau();
  repos.roleRules.create(GUILD, { triggerRoleId: 'B', removeRoleIds: ['A'], enabled: false });
  repos.memberRoles.put(GUILD, 'u1', ['A']);
  const { member, entfernt } = baueMitglied({ rollen: ['A', 'B'] });

  await verarbeiteRollenAenderung(member, { repos, config });
  assert.deepEqual(entfernt, []);
});

test('automatische Rollen-Nachricht wird für neu vergebene Rollen ausgelöst', async () => {
  const { repos } = aufbau();
  repos.memberRoles.put(GUILD, 'u1', []);
  const { member } = baueMitglied({ rollen: ['B'] });

  const gemeldet = [];
  await verarbeiteRollenAenderung(member, {
    repos,
    config,
    onRolleVergeben: (_m, roleId) => gemeldet.push(roleId),
  });

  assert.deepEqual(gemeldet, ['B']);
});

test('gleichzeitige Ereignisse am selben Mitglied verschlucken keine Änderung', async () => {
  const { repos } = aufbau();
  repos.roleRules.create(GUILD, { triggerRoleId: 'B', removeRoleIds: ['A'] });
  repos.memberRoles.put(GUILD, 'u1', ['A']);
  const { member, entfernt } = baueMitglied({ rollen: ['A', 'B'] });

  // Zwei Auswertungen ohne Wartezeit dazwischen — der Mutex serialisiert sie.
  await Promise.all([
    verarbeiteRollenAenderung(member, { repos, config }),
    verarbeiteRollenAenderung(member, { repos, config }),
  ]);

  assert.deepEqual(entfernt, ['A'], 'A darf nur einmal entfernt werden');
  assert.deepEqual(repos.memberRoles.get(GUILD, 'u1'), ['B']);
});
