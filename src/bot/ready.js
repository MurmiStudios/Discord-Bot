/**
 * Startroutine, sobald der Bot verbunden ist.
 *
 * Der wichtigste Schritt ist das einmalige Laden aller Mitglieder: nur so hat
 * die Regel-Auswertung nach einem Neustart einen korrekten Vergleichsstand.
 * Ohne diese Befüllung würde der erste Rollenwechsel je Mitglied als
 * "Erstsichtung" behandelt und die Regel griffe nicht.
 *
 * Das kostet bei sehr grossen Servern Zeit und Speicher — für einen
 * mittelgrossen Server ist es der richtige Kompromiss.
 */
import { registriereGuildMemberAdd } from './events/guildMemberAdd.js';
import { registriereGuildMemberUpdate } from './events/guildMemberUpdate.js';
import { registriereGuildMemberRemove } from './events/guildMemberRemove.js';

export async function befuelleMomentaufnahmen(guild, repos, log) {
  const mitglieder = await guild.members.fetch();
  const eintraege = [...mitglieder.values()].map((m) => ({
    userId: m.id,
    roleIds: [...m.roles.cache.keys()].filter((r) => r !== guild.id),
  }));
  repos.memberRoles.putMany(guild.id, eintraege);
  log.info({ anzahl: eintraege.length }, 'Rollen-Momentaufnahmen befüllt');
  return eintraege.length;
}

export function registriereEreignisse(client, kontext) {
  registriereGuildMemberAdd(client, kontext);
  registriereGuildMemberUpdate(client, kontext);
  registriereGuildMemberRemove(client, kontext);
}

/**
 * Wird einmal bei clientReady ausgeführt.
 * @returns {Promise<import('discord.js').Guild>} der verwaltete Server
 */
export async function beiBereit(client, { repos, config, log }) {
  log.info({ tag: client.user.tag }, 'Mit Discord verbunden');

  const guild = client.guilds.cache.get(config.GUILD_ID);
  if (!guild) {
    log.error(
      `Der Bot ist kein Mitglied des Servers mit der ID ${config.GUILD_ID}.\n` +
        '  Prüfe GUILD_ID in der .env und lade den Bot auf den Server ein.',
    );
    return null;
  }

  try {
    await befuelleMomentaufnahmen(guild, repos, log);
  } catch (err) {
    // Der häufigste Grund ist der fehlende privilegierte Intent.
    log.error(
      { err },
      'Mitglieder konnten nicht geladen werden. Ist der SERVER MEMBERS INTENT ' +
        'im Developer Portal aktiviert? Ohne ihn greifen Rollenregeln und ' +
        'Willkommensnachrichten nicht.',
    );
  }

  const ich = guild.members.me;
  log.info(
    { server: guild.name, mitglieder: guild.memberCount, botRolle: ich?.roles.highest.name },
    'Server bereit',
  );

  return guild;
}
