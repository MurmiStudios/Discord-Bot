/**
 * Discord-Client.
 *
 * GuildMembers ist ein PRIVILEGIERTER Intent und muss im Developer Portal
 * unter Bot → Privileged Gateway Intents als "SERVER MEMBERS INTENT" aktiviert
 * sein. Fehlt er, scheitert bereits der Login mit "Used disallowed intents",
 * und weder Willkommens-DMs noch Rollenregeln funktionieren.
 *
 * MessageContent wird bewusst NICHT angefordert — der Bot liest nie
 * Nachrichteninhalte.
 */
import { Client, GatewayIntentBits, Partials } from 'discord.js';

export function createClient() {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds, // Rollen-, Kanal- und Server-Cache
      GatewayIntentBits.GuildMembers, // guildMemberAdd / Update / Remove
    ],
    // Channel wird gebraucht, um Ereignisse auf DM-Kanälen zu erhalten.
    partials: [Partials.GuildMember, Partials.User, Partials.Channel],
  });
}

/**
 * Meldet den Bot an und liefert eine verständliche Meldung, wenn der
 * häufigste Einrichtungsfehler auftritt.
 */
export async function login(client, token, log) {
  try {
    await client.login(token);
  } catch (err) {
    if (String(err?.message ?? '').includes('disallowed intents')) {
      log.error(
        'Discord hat die Anmeldung abgelehnt: der privilegierte Intent fehlt.\n' +
          '  Developer Portal → Applications → deine App → Bot →\n' +
          '  Privileged Gateway Intents → "SERVER MEMBERS INTENT" aktivieren.',
      );
    } else if (String(err?.message ?? '').includes('token')) {
      log.error('Discord hat den Bot-Token abgelehnt. Stimmt DISCORD_TOKEN in der .env?');
    } else {
      log.error({ err }, 'Anmeldung bei Discord fehlgeschlagen');
    }
    throw err;
  }
}
