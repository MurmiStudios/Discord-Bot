/**
 * Direktnachrichten versenden.
 *
 * Ob jemand DMs gesperrt hat, lässt sich NICHT vorab prüfen — Discord bietet
 * keinen entsprechenden Endpunkt. Man erfährt es nur, indem man es versucht
 * und Fehlercode 50007 abfängt. Deshalb liefert sendDM nie eine Ausnahme,
 * sondern immer ein Ergebnisobjekt, das das Panel direkt anzeigen kann.
 */
import { AttachmentBuilder, EmbedBuilder } from 'discord.js';

export const BILD_DATEINAME = 'karte.png';

/** Übersetzt Discord-Fehlercodes in Text, den man im Panel verstehen kann. */
export function mapDmError(err) {
  const code = err?.code;
  switch (code) {
    case 50007:
      return 'Nutzer hat DMs deaktiviert oder den Bot blockiert';
    case 50013:
      return 'Dem Bot fehlen die nötigen Berechtigungen';
    case 50001:
      return 'Der Bot hat keinen Zugriff auf diesen Nutzer';
    case 10013:
      return 'Unbekannter Nutzer — die ID existiert nicht (mehr)';
    case 10003:
      return 'Unbekannter Kanal';
    case 40002:
      return 'Discord verweigert die Anfrage (Konto eingeschränkt)';
    case 50278:
      return 'Nachricht kann diesem Nutzer nicht zugestellt werden';
    case 20026:
      return 'Nachricht ist zu lang';
    default:
      if (err?.name === 'AbortError') return 'Zeitüberschreitung bei der Anfrage an Discord';
      return err?.message ? `Unerwarteter Fehler: ${err.message}` : 'Unbekannter Fehler';
  }
}

/**
 * Baut die Nachricht zusammen. Ein erzeugtes Bild wird angehängt und im Embed
 * über attachment:// referenziert — sonst hinge es lose unter dem Embed statt
 * darin.
 */
export function baueNachricht({ content = '', title = '', bild = null, farbe = 0x5865f2 }) {
  const payload = {};
  const dateien = [];

  if (bild) {
    dateien.push(new AttachmentBuilder(bild, { name: BILD_DATEINAME }));
  }

  // Ein Embed lohnt sich nur, wenn es einen Titel oder ein Bild gibt.
  if (title || bild) {
    const embed = new EmbedBuilder().setColor(farbe);
    if (title) embed.setTitle(title);
    if (content) embed.setDescription(content);
    if (bild) embed.setImage(`attachment://${BILD_DATEINAME}`);
    payload.embeds = [embed];
  } else if (content) {
    payload.content = content;
  }

  if (dateien.length) payload.files = dateien;
  return payload;
}

/**
 * Schickt einem Nutzer eine DM.
 * @returns {Promise<{ok:boolean, code?:number, grund?:string}>}
 */
export async function sendDM(client, userId, nachricht) {
  try {
    const user = await client.users.fetch(userId);
    const payload = baueNachricht(nachricht);
    if (!payload.content && !payload.embeds) {
      return { ok: false, grund: 'Die Nachricht ist leer' };
    }
    await user.send(payload);
    return { ok: true };
  } catch (err) {
    return { ok: false, code: err?.code, grund: mapDmError(err) };
  }
}
