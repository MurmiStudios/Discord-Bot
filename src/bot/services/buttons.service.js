/**
 * Baut aus einer gespeicherten Aktionsleiste die Discord-Komponenten.
 *
 * Die `custom_id` verweist nur auf die Datenbank-ID (`btn:<id>`). Das ist
 * wichtig, weil Buttons in bereits zugestellten Nachrichten ewig weiterleben:
 * Nach einem Neustart des Bots muss ein Klick weiterhin zugeordnet werden
 * können, und dafür darf nichts im Arbeitsspeicher gehalten werden.
 */
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { BUTTONS_JE_REIHE, MAX_BUTTONS } from './buttonActions.schema.js';

const STIL_ZU_DISCORD = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
};

export const CUSTOM_ID_PRAEFIX = 'btn:';

export const customIdFuer = (buttonId) => `${CUSTOM_ID_PRAEFIX}${buttonId}`;

/** @returns {number|null} Button-ID, oder null wenn die Kennung nicht zu uns gehört. */
export function buttonIdAusCustomId(customId) {
  if (typeof customId !== 'string' || !customId.startsWith(CUSTOM_ID_PRAEFIX)) return null;
  const id = Number(customId.slice(CUSTOM_ID_PRAEFIX.length));
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Erzeugt die Komponenten-Zeilen. Discord erlaubt fünf Buttons je Reihe und
 * fünf Reihen, deshalb wird automatisch umgebrochen und bei 25 abgeschnitten.
 *
 * @returns {ActionRowBuilder[]} leer, wenn es nichts anzuzeigen gibt
 */
export function baueAktionsleiste(buttons) {
  const aktive = (buttons ?? []).filter((b) => b.enabled).slice(0, MAX_BUTTONS);
  const zeilen = [];

  for (let i = 0; i < aktive.length; i += BUTTONS_JE_REIHE) {
    const reihe = new ActionRowBuilder();

    for (const b of aktive.slice(i, i + BUTTONS_JE_REIHE)) {
      const knopf = new ButtonBuilder()
        .setCustomId(customIdFuer(b.id))
        .setLabel(b.label.slice(0, 80))
        .setStyle(STIL_ZU_DISCORD[b.style] ?? ButtonStyle.Primary);

      if (b.emoji) {
        // Ein ungültiges Emoji würde die ganze Nachricht scheitern lassen —
        // lieber den Button ohne Emoji senden.
        try {
          knopf.setEmoji(b.emoji);
        } catch {
          /* absichtlich ignoriert */
        }
      }
      reihe.addComponents(knopf);
    }
    zeilen.push(reihe);
  }
  return zeilen;
}

/**
 * Lädt eine Leiste und baut ihre Komponenten. Gibt eine leere Liste zurück,
 * wenn keine Leiste gewählt wurde oder sie inzwischen gelöscht ist.
 */
export function komponentenFuerSet(repos, guildId, setId) {
  if (!setId) return [];
  const set = repos.buttonSets.setMitButtons(guildId, Number(setId));
  if (!set) return [];
  return baueAktionsleiste(set.buttons);
}
