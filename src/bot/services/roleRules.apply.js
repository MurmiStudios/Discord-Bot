/**
 * Ausführungsschicht der Rollenregeln.
 *
 * Die Planung selbst steckt in roleRules.engine.js und ist eine reine
 * Funktion. Hier kommt alles dazu, was mit der Aussenwelt zu tun hat:
 * Nebenläufigkeit, Berechtigungen, API-Aufrufe und Protokollierung.
 */
import { planRemovals, diffRollen } from './roleRules.engine.js';
import { rolleVerwaltbar, rolleName } from './role.service.js';

/**
 * Ein Versprechen je Mitglied. Zwei schnell aufeinanderfolgende
 * Rollenänderungen am selben Mitglied würden sonst ineinandergreifen und beim
 * Fortschreiben der Momentaufnahme eine Änderung verschlucken.
 */
const sperren = new Map();

function mitSperre(userId, arbeit) {
  const vorher = sperren.get(userId) ?? Promise.resolve();
  const jetzt = vorher.then(arbeit, arbeit);
  // Kette aufräumen, sobald niemand mehr wartet.
  sperren.set(
    userId,
    jetzt.catch(() => {}).finally(() => {
      if (sperren.get(userId) === jetzt) sperren.delete(userId);
    }),
  );
  return jetzt;
}

/** Nur für Tests: laufende Sperren zurücksetzen. */
export function _sperrenLeeren() {
  sperren.clear();
}

/**
 * Wertet ein guildMemberUpdate aus und wendet die Regeln an.
 *
 * @returns {Promise<{aktion:string, entfernt?:string[], uebersprungen?:object[]}>}
 */
export async function verarbeiteRollenAenderung(member, { repos, config, log, onRolleVergeben }) {
  const guild = member.guild;
  if (guild.id !== config.GUILD_ID) return { aktion: 'fremder-server' };

  return mitSperre(member.id, async () => {
    const jetzt = [...member.roles.cache.keys()].filter((r) => r !== guild.id);
    const vorher = repos.memberRoles.get(guild.id, member.id);
    const diff = diffRollen(vorher, jetzt);

    // Erstsichtung: nur merken, niemals handeln. Sonst würde nach einem
    // Neustart der gesamte Rollenbestand als "gerade vergeben" gelten.
    if (diff.erstsichtung) {
      repos.memberRoles.put(guild.id, member.id, jetzt);
      return { aktion: 'erstsichtung' };
    }

    // Nur schreiben, wenn sich wirklich etwas geändert hat — guildMemberUpdate
    // feuert auch bei Namens- und Avataränderungen.
    if (diff.geaendert) repos.memberRoles.put(guild.id, member.id, jetzt);

    if (diff.hinzugefuegt.length === 0) {
      // Genau hier endet die Rekursion: unser eigenes Entfernen löst ein
      // Folgeereignis aus, das nichts hinzugefügt hat.
      return { aktion: 'nichts-hinzugefuegt' };
    }

    const regelnAktiv = repos.roleRules.allEnabled(guild.id);
    const { entfernen, gruende } = planRemovals(diff.hinzugefuegt, jetzt, regelnAktiv);

    const uebersprungen = [];
    const erlaubt = [];
    for (const roleId of entfernen) {
      const rolle = guild.roles.cache.get(roleId);
      if (!rolle) {
        uebersprungen.push({ roleId, grund: 'Rolle existiert nicht mehr' });
        continue;
      }
      const pruef = rolleVerwaltbar(guild, rolle);
      if (!pruef.verwaltbar) {
        uebersprungen.push({ roleId, name: rolle.name, grund: pruef.grund });
        continue;
      }
      erlaubt.push(roleId);
    }

    for (const u of uebersprungen) {
      repos.log.add(guild.id, {
        kind: 'rule_applied',
        status: 'skipped',
        targetUserId: member.id,
        detail: `Rolle „${u.name ?? u.roleId}“ nicht entfernt: ${u.grund}`,
      });
      log?.warn({ userId: member.id, roleId: u.roleId }, `Rollenregel übersprungen: ${u.grund}`);
    }

    if (erlaubt.length > 0) {
      const namen = erlaubt.map((r) => rolleName(guild, r)).join(', ');
      const ausloeser = [...new Set(gruende.map((g) => rolleName(guild, g.trigger)))].join(', ');
      const begruendung = `Rollenregel: „${ausloeser}“ vergeben → entfernt: ${namen}`.slice(0, 512);

      try {
        // EIN gebündelter Aufruf statt N einzelner: ein Rate-Limit-Eintrag,
        // ein Audit-Log-Eintrag und ein Folgeereignis statt N.
        await member.roles.remove(erlaubt, begruendung);

        // Momentaufnahme sofort nachziehen, damit das Folgeereignis sie
        // bereits aktuell vorfindet.
        repos.memberRoles.put(
          guild.id,
          member.id,
          jetzt.filter((r) => !erlaubt.includes(r)),
        );

        repos.log.add(guild.id, {
          kind: 'rule_applied',
          status: 'ok',
          targetUserId: member.id,
          detail: begruendung,
        });
        log?.info({ userId: member.id, entfernt: erlaubt }, 'Rollenregel angewandt');
      } catch (err) {
        repos.log.add(guild.id, {
          kind: 'rule_applied',
          status: 'failed',
          targetUserId: member.id,
          errorCode: err?.code,
          detail: `Entfernen fehlgeschlagen: ${err?.message ?? 'unbekannt'}`,
        });
        log?.error({ err, userId: member.id }, 'Rollenregel konnte nicht angewandt werden');
      }
    }

    // Automatische Rollen-Nachrichten für die neu vergebenen Rollen.
    if (onRolleVergeben) {
      for (const roleId of diff.hinzugefuegt) {
        try {
          await onRolleVergeben(member, roleId);
        } catch (err) {
          log?.error({ err, roleId }, 'Automatische Rollen-Nachricht fehlgeschlagen');
        }
      }
    }

    return { aktion: 'angewandt', entfernt: erlaubt, uebersprungen };
  });
}
