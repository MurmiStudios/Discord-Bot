/**
 * Nachrichten in Kanäle senden.
 *
 * Die Auswahl im Panel wird gefiltert, aber die eigentliche Prüfung passiert
 * hier auf dem Server: eine manipulierte Kanal-ID im Formular darf nicht dazu
 * führen, dass der Bot irgendwo hinschreibt.
 */
import { ChannelType, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

const TEXT_TYPEN = new Set([
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
  ChannelType.AnnouncementThread,
]);

export function kanalBeschreibbar(guild, kanal) {
  if (!kanal) return { ok: false, grund: 'Kanal nicht gefunden' };
  if (kanal.guildId !== guild.id) return { ok: false, grund: 'Kanal gehört nicht zu diesem Server' };
  if (!TEXT_TYPEN.has(kanal.type)) return { ok: false, grund: 'Kein Textkanal' };

  const rechte = kanal.permissionsFor(guild.members.me);
  if (!rechte?.has(PermissionFlagsBits.ViewChannel)) {
    return { ok: false, grund: 'Der Bot sieht diesen Kanal nicht' };
  }
  if (!rechte.has(PermissionFlagsBits.SendMessages)) {
    return { ok: false, grund: 'Der Bot darf in diesem Kanal nicht schreiben' };
  }
  return { ok: true, grund: '' };
}

/** Kanäle für die Auswahlliste — nur solche, in die der Bot wirklich schreiben kann. */
export function listeKanaele(guild) {
  return [...guild.channels.cache.values()]
    .filter((k) => TEXT_TYPEN.has(k.type))
    .map((k) => {
      const { ok, grund } = kanalBeschreibbar(guild, k);
      return {
        id: k.id,
        name: k.name,
        type: k.type,
        parent: k.parent?.name ?? '',
        position: k.rawPosition ?? 0,
        beschreibbar: ok,
        grund,
      };
    })
    .sort((a, b) => a.parent.localeCompare(b.parent) || a.position - b.position);
}

/**
 * Sendet in einen Kanal.
 * @returns {Promise<{ok:boolean, code?:number, grund?:string, messageId?:string}>}
 */
export async function sendToChannel(guild, channelId, { content = '', title = '', farbe = 0x5865f2, components = [] }) {
  const kanal = guild.channels.cache.get(channelId) ?? null;
  const pruefung = kanalBeschreibbar(guild, kanal);
  if (!pruefung.ok) return { ok: false, grund: pruefung.grund };

  try {
    const payload = title
      ? {
          embeds: [
            new EmbedBuilder()
              .setColor(farbe)
              .setTitle(title)
              .setDescription(content || null),
          ],
        }
      : { content };

    if (components.length) payload.components = components;

    // Eine Nachricht, die nur aus Buttons besteht, ist zulässig.
    if (!title && !content.trim() && components.length === 0) {
      return { ok: false, grund: 'Die Nachricht ist leer' };
    }

    const msg = await kanal.send(payload);
    return { ok: true, messageId: msg.id };
  } catch (err) {
    return { ok: false, code: err?.code, grund: err?.message ?? 'Unbekannter Fehler' };
  }
}
