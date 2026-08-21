/**
 * Rollen abfragen und prüfen, ob der Bot sie überhaupt verwalten darf.
 *
 * Die Prüfung wird an zwei Stellen gebraucht: im Panel, um nicht verwaltbare
 * Rollen schon bei der Konfiguration auszugrauen, und zur Laufzeit als letzte
 * Verteidigungslinie in der Regel-Auswertung.
 */
import { PermissionFlagsBits } from 'discord.js';

/**
 * @returns {{verwaltbar:boolean, grund:string}}
 */
export function rolleVerwaltbar(guild, rolle) {
  const ich = guild.members.me;
  if (!ich) return { verwaltbar: false, grund: 'Bot-Mitglied nicht geladen' };

  if (!ich.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return { verwaltbar: false, grund: 'Dem Bot fehlt die Berechtigung „Rollen verwalten“' };
  }
  if (rolle.id === guild.id) {
    return { verwaltbar: false, grund: '@everyone kann nicht vergeben oder entzogen werden' };
  }
  if (rolle.managed) {
    return {
      verwaltbar: false,
      grund: 'Rolle wird von einer Integration verwaltet (z. B. Bot- oder Booster-Rolle)',
    };
  }
  if (ich.roles.highest.comparePositionTo(rolle) <= 0) {
    return {
      verwaltbar: false,
      grund: `Rolle „${rolle.name}“ steht über der Rolle des Bots — schiebe die Bot-Rolle höher`,
    };
  }
  return { verwaltbar: true, grund: '' };
}

/** Alle Rollen des Servers, für Auswahllisten im Panel aufbereitet. */
export function listeRollen(guild) {
  if (!guild) return [];
  return [...guild.roles.cache.values()]
    .filter((r) => r.id !== guild.id)
    .sort((a, b) => b.position - a.position)
    .map((r) => {
      const { verwaltbar, grund } = rolleVerwaltbar(guild, r);
      return {
        id: r.id,
        name: r.name,
        color: r.hexColor,
        position: r.position,
        managed: r.managed,
        memberCount: r.members.size,
        verwaltbar,
        grund,
      };
    });
}

export function rolleName(guild, roleId) {
  return guild?.roles.cache.get(roleId)?.name ?? `Unbekannte Rolle (${roleId})`;
}
