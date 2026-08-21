/**
 * Klicks auf die Buttons der Aktionsleisten.
 *
 * Interaktionen kommen über das Gateway ohne zusätzlichen Intent an — es muss
 * also nichts im Developer Portal umgestellt werden.
 */
import { buttonIdAusCustomId } from '../services/buttons.service.js';
import { verarbeiteButtonKlick } from '../services/buttonClick.service.js';

export function registriereInteractionCreate(client, { repos, config, log }) {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const buttonId = buttonIdAusCustomId(interaction.customId);
    // Fremde Kennungen ignorieren — sie stammen nicht aus diesem Panel.
    if (buttonId === null) return;

    try {
      await verarbeiteButtonKlick(interaction, buttonId, { client, repos, config, log });
    } catch (err) {
      log.error({ err, buttonId }, 'Button-Klick konnte nicht verarbeitet werden');
      // Letzte Rettung: dem Mitglied nicht die Discord-Standardmeldung
      // „Diese Interaktion ist fehlgeschlagen" hinterlassen.
      const text = 'Beim Ausführen ist ein Fehler aufgetreten.';
      if (interaction.deferred) await interaction.editReply({ content: text }).catch(() => {});
      else if (!interaction.replied) await interaction.reply({ content: text, ephemeral: true }).catch(() => {});
    }
  });
}
