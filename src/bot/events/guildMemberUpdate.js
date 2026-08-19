/**
 * Rollenwechsel: dünner Adapter auf die Regel-Auswertung.
 *
 * Bewusst ohne eigene Logik — `oldMember` wird absichtlich nicht benutzt (es
 * ist nur bei gecachten Mitgliedern zuverlässig); die Auswertung vergleicht
 * gegen die gespeicherte Momentaufnahme.
 */
import { verarbeiteRollenAenderung } from '../services/roleRules.apply.js';
import { sendeAutoRollenNachrichten } from '../services/messaging.service.js';

export function registriereGuildMemberUpdate(client, { repos, config, log }) {
  client.on('guildMemberUpdate', async (_alt, neu) => {
    try {
      await verarbeiteRollenAenderung(neu, {
        repos,
        config,
        log,
        onRolleVergeben: (member, roleId) =>
          sendeAutoRollenNachrichten({
            client,
            guild: member.guild,
            member,
            roleId,
            repos,
            config,
            log,
          }),
      });
    } catch (err) {
      log.error({ err, userId: neu.id }, 'Rollenänderung konnte nicht verarbeitet werden');
    }
  });
}
