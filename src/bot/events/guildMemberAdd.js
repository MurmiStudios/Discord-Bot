/**
 * Neues Mitglied: Willkommens-DM mit dynamischem Bild.
 *
 * Die Momentaufnahme der Rollen wird gleich mit angelegt, damit die
 * Regel-Auswertung beim ersten Rollenwechsel dieses Mitglieds einen
 * korrekten Vergleichsstand hat.
 */
import { sendeVorlagenDM } from '../services/messaging.service.js';

export function registriereGuildMemberAdd(client, { repos, config, log }) {
  client.on('guildMemberAdd', async (member) => {
    if (member.guild.id !== config.GUILD_ID) return;

    try {
      repos.memberRoles.put(
        member.guild.id,
        member.id,
        [...member.roles.cache.keys()].filter((r) => r !== member.guild.id),
      );
    } catch (err) {
      log.error({ err, userId: member.id }, 'Momentaufnahme für neues Mitglied fehlgeschlagen');
    }

    const aktiv = repos.settings.get('welcome.enabled', false);
    if (!aktiv) return;

    const text = repos.settings.get('welcome.body', '');
    const titel = repos.settings.get('welcome.title', '');
    const templateId = repos.settings.get('welcome.template_id', null);

    if (!text && !titel && !templateId) {
      log.warn('Willkommensnachricht ist aktiv, aber es ist kein Inhalt hinterlegt.');
      return;
    }

    const res = await sendeVorlagenDM({
      client,
      guild: member.guild,
      member,
      templateId,
      titel,
      text,
      kind: 'welcome_dm',
      repos,
      config,
    });

    if (res.ok) {
      log.info({ userId: member.id }, 'Willkommens-DM zugestellt');
    } else {
      log.warn({ userId: member.id, grund: res.grund }, 'Willkommens-DM nicht zugestellt');
    }
  });
}
