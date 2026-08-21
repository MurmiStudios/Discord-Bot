/**
 * Verarbeitet Klicks auf die Buttons einer Aktionsleiste.
 *
 * Zwei Eigenheiten von Discord bestimmen den Aufbau:
 *
 * 1. Eine Interaktion muss innerhalb von drei Sekunden beantwortet werden,
 *    sonst zeigt Discord dem Mitglied „Diese Interaktion ist fehlgeschlagen".
 *    DMs und Rollenänderungen können länger dauern, deshalb wird sofort
 *    aufgeschoben (deferReply) und erst danach gearbeitet.
 *
 * 2. Buttons in bereits zugestellten Nachrichten leben ewig weiter. Der
 *    Handler darf sich daher auf nichts im Arbeitsspeicher verlassen — alles
 *    kommt über die Button-ID aus der Datenbank.
 */
import { MessageFlags } from 'discord.js';
import { rolleVerwaltbar } from './role.service.js';
import { sendeVorlagenDM } from './messaging.service.js';
import { normalizeAktionen } from './buttonActions.schema.js';

/**
 * Darf dieses Mitglied den Button benutzen?
 *
 * Reine Funktion ohne Discord-Zugriff, damit die Zugriffslogik vollständig
 * testbar bleibt. Die Einmal-Sperre wird hier NICHT geprüft — sie braucht
 * einen Schreibvorgang und steckt deshalb in der Ausführung.
 *
 * @returns {{erlaubt: boolean, grund: string}}
 */
export function pruefeButtonZugriff(button, mitgliedRollenIds) {
  if (!button) return { erlaubt: false, grund: 'Diesen Button gibt es nicht mehr.' };
  if (!button.enabled) return { erlaubt: false, grund: 'Dieser Button ist deaktiviert.' };

  // Leere Liste heisst: alle dürfen.
  if (button.allowedRoleIds.length === 0) return { erlaubt: true, grund: '' };

  const hat = new Set(mitgliedRollenIds ?? []);
  const passt = button.allowedRoleIds.some((r) => hat.has(r));
  return passt
    ? { erlaubt: true, grund: '' }
    : { erlaubt: false, grund: 'Dir fehlt die nötige Rolle für diesen Button.' };
}

/** Führt eine einzelne Aktion aus. Wirft nie — Fehler werden zurückgegeben. */
async function fuehreAktionAus(aktion, kontext) {
  const { client, guild, member, repos, config, log } = kontext;

  try {
    if (aktion.typ === 'dm_klicker') {
      const r = await sendeVorlagenDM({
        client,
        guild,
        member,
        templateId: aktion.templateId,
        titel: aktion.titel,
        text: aktion.text,
        kind: 'dm',
        repos,
        config,
      });
      return r.ok
        ? { ok: true, text: 'Dir wurde eine Nachricht geschickt.' }
        : { ok: false, text: `DM an dich fehlgeschlagen: ${r.grund}` };
    }

    if (aktion.typ === 'dm_person') {
      const ziel = await guild.members.fetch(aktion.userId).catch(() => null);
      if (!ziel) return { ok: false, text: 'Der hinterlegte Empfänger ist kein Mitglied mehr.' };

      const r = await sendeVorlagenDM({
        client,
        guild,
        member: ziel,
        templateId: aktion.templateId,
        titel: aktion.titel,
        text: aktion.text,
        kind: 'dm',
        // Der Klickende ist der Auslöser — so steht im Protokoll, wer es war.
        actorId: member.id,
        zusatz: { klicker: member.displayName },
        repos,
        config,
      });
      return r.ok
        ? { ok: true, text: 'Benachrichtigung verschickt.' }
        : { ok: false, text: `Benachrichtigung fehlgeschlagen: ${r.grund}` };
    }

    if (aktion.typ === 'rolle') {
      const rolle = guild.roles.cache.get(aktion.roleId);
      if (!rolle) return { ok: false, text: 'Die hinterlegte Rolle gibt es nicht mehr.' };

      const pruef = rolleVerwaltbar(guild, rolle);
      if (!pruef.verwaltbar) {
        log?.warn({ roleId: aktion.roleId }, `Button-Rolle nicht verwaltbar: ${pruef.grund}`);
        return { ok: false, text: `Rolle „${rolle.name}“ kann nicht geändert werden.` };
      }

      const hatSie = member.roles.cache.has(aktion.roleId);
      const grund = `Button-Aktion (${member.user.tag})`.slice(0, 512);

      // umschalten macht Selbstbedienungs-Rollen möglich.
      const entfernen = aktion.modus === 'entfernen' || (aktion.modus === 'umschalten' && hatSie);

      if (entfernen) {
        if (!hatSie) return { ok: true, text: `Du hattest „${rolle.name}“ ohnehin nicht.` };
        await member.roles.remove(aktion.roleId, grund);
        return { ok: true, text: `Rolle „${rolle.name}“ entfernt.` };
      }

      if (hatSie) return { ok: true, text: `Du hast „${rolle.name}“ bereits.` };
      await member.roles.add(aktion.roleId, grund);
      return { ok: true, text: `Rolle „${rolle.name}“ erhalten.` };
    }

    return { ok: false, text: 'Unbekannte Aktion.' };
  } catch (err) {
    log?.error({ err, typ: aktion.typ }, 'Button-Aktion fehlgeschlagen');
    const code = err?.code;
    if (code === 50013) return { ok: false, text: 'Dem Bot fehlen die nötigen Berechtigungen.' };
    return { ok: false, text: 'Die Aktion konnte nicht ausgeführt werden.' };
  }
}

/**
 * Vollständige Verarbeitung eines Button-Klicks.
 *
 * @returns {Promise<{status:string, meldungen:string[]}>} nur für Tests und Protokoll
 */
export async function verarbeiteButtonKlick(interaction, buttonId, { client, repos, config, log }) {
  // Zuerst aufschieben — alles Weitere darf jetzt so lange dauern, wie es muss.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

  const antworten = async (text) => {
    await interaction.editReply({ content: text.slice(0, 2000) }).catch(() => {});
  };

  const button = repos.buttonSets.buttonById(buttonId);

  // Der Klick kann aus einer DM kommen — dort ist interaction.guild null.
  // Deshalb immer der verwaltete Server aus der Konfiguration.
  const guild = client.guilds.cache.get(config.GUILD_ID);
  if (!guild) {
    await antworten('Der Bot ist gerade nicht mit dem Server verbunden. Bitte später erneut versuchen.');
    return { status: 'kein-server', meldungen: [] };
  }

  const member = await guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) {
    await antworten('Du bist kein Mitglied dieses Servers.');
    return { status: 'kein-mitglied', meldungen: [] };
  }

  const zugriff = pruefeButtonZugriff(button, [...member.roles.cache.keys()]);
  if (!zugriff.erlaubt) {
    await antworten(zugriff.grund);
    return { status: 'abgewiesen', meldungen: [zugriff.grund] };
  }

  // Einmal-Sperre: vormerken BEVOR gearbeitet wird. Der Primärschlüssel macht
  // das atomar, sodass zwei schnelle Klicks nicht beide durchkommen.
  let vorgemerkt = false;
  if (button.oncePerUser) {
    vorgemerkt = repos.buttonSets.nutzungVormerken(button.id, member.id);
    if (!vorgemerkt) {
      await antworten('Du hast diesen Button bereits benutzt.');
      return { status: 'schon-benutzt', meldungen: [] };
    }
  }

  const aktionen = normalizeAktionen(button.actions);
  if (aktionen.length === 0) {
    await antworten(button.replyText || 'Für diesen Button ist keine Aktion hinterlegt.');
    return { status: 'keine-aktion', meldungen: [] };
  }

  const meldungen = [];
  let erfolge = 0;
  for (const aktion of aktionen) {
    // Nacheinander, nicht parallel: die Reihenfolge ist im Panel festgelegt
    // und soll auch so ausgeführt werden.
    const r = await fuehreAktionAus(aktion, { client, guild, member, repos, config, log });
    meldungen.push(r.text);
    if (r.ok) erfolge += 1;
  }

  // Ist gar nichts gelungen, die Sperre wieder lösen — sonst wäre das Mitglied
  // wegen eines Fehlers dauerhaft ausgesperrt.
  if (vorgemerkt && erfolge === 0) {
    repos.buttonSets.nutzungLoesen(button.id, member.id);
  }

  repos.log.add(config.GUILD_ID, {
    kind: 'button',
    status: erfolge === aktionen.length ? 'ok' : erfolge > 0 ? 'failed' : 'failed',
    actorId: member.id,
    targetUserId: member.id,
    detail: `Button „${button.label}“: ${erfolge}/${aktionen.length} erfolgreich — ${meldungen.join(' ')}`,
    payloadExcerpt: button.label,
  });

  const kopf = button.replyText ? `${button.replyText}\n\n` : '';
  await antworten(kopf + meldungen.join('\n'));

  return { status: erfolge === aktionen.length ? 'ok' : 'teilweise', meldungen };
}
