/**
 * Bindeglied zwischen Bildpipeline und Versand.
 *
 * Willkommens-DM, automatische Rollen-DM und der Versand von Hand aus dem
 * Panel laufen alle hier durch — dadurch sehen alle drei gleich aus und
 * protokollieren gleich.
 */
import { renderCard, vorlageAusDatensatz, platzhalterErsetzen } from '../../images/renderer.js';
import { sendDM } from './dm.service.js';
import { avatarUrl } from './member.service.js';
import { rolleName } from './role.service.js';
import { komponentenFuerSet } from './buttons.service.js';

/**
 * Rendert die Vorlage (falls eine hinterlegt ist) und schickt die DM.
 *
 * @returns {Promise<{ok:boolean, code?:number, grund?:string, hinweise:string[]}>}
 */
export async function sendeVorlagenDM({
  client,
  guild,
  member,
  templateId,
  titel = '',
  text = '',
  kind,
  actorId = null,
  zusatz = {},
  buttonSetId = null,
  repos,
  config,
}) {
  const werte = {
    guild: guild.name,
    count: guild.memberCount,
    ...zusatz,
  };

  let bild = null;
  const hinweise = [];

  if (templateId) {
    const vorlage = repos.templates.byId(guild.id, templateId);
    if (!vorlage) {
      hinweise.push('Die hinterlegte Bildvorlage existiert nicht mehr — DM wird ohne Bild gesendet.');
    } else {
      try {
        const ergebnis = await renderCard(
          vorlageAusDatensatz(vorlage, config.uploadsDir),
          {
            displayName: member.displayName,
            username: member.user.username,
            avatarUrl: avatarUrl(member),
          },
          werte,
        );
        bild = ergebnis.buffer;
        hinweise.push(...ergebnis.hinweise);
      } catch (err) {
        // Ein Renderfehler darf die Nachricht nicht verhindern — lieber ohne
        // Bild zustellen als gar nicht.
        hinweise.push(`Bild konnte nicht erzeugt werden: ${err.message}`);
      }
    }
  }

  const ergebnis = await sendDM(client, member.id, {
    content: platzhalterErsetzen(text, { ...werte, user: member.displayName, tag: member.user.username }),
    title: platzhalterErsetzen(titel, { ...werte, user: member.displayName, tag: member.user.username }),
    bild,
    components: komponentenFuerSet(repos, guild.id, buttonSetId),
  });

  repos.log.add(guild.id, {
    kind,
    status: ergebnis.ok ? 'ok' : 'failed',
    actorId,
    targetUserId: member.id,
    templateId: templateId ?? null,
    errorCode: ergebnis.code ?? null,
    detail: ergebnis.ok ? hinweise.join(' ') : ergebnis.grund,
    payloadExcerpt: text,
  });

  return { ...ergebnis, hinweise };
}

/** Schickt alle automatisch hinterlegten Nachrichten zu einer neu vergebenen Rolle. */
export async function sendeAutoRollenNachrichten({ client, guild, member, roleId, repos, config, log }) {
  const nachrichten = repos.roleMessages.autoForRole(guild.id, roleId);
  for (const n of nachrichten) {
    const res = await sendeVorlagenDM({
      client,
      guild,
      member,
      templateId: n.templateId,
      titel: n.title,
      text: n.body,
      kind: 'role_dm',
      zusatz: { role: rolleName(guild, roleId) },
      buttonSetId: n.buttonSetId,
      repos,
      config,
    });
    if (!res.ok) {
      log?.warn({ userId: member.id, roleId, grund: res.grund }, 'Automatische Rollen-DM fehlgeschlagen');
    }
  }
  return nachrichten.length;
}
