import express from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { flashUndZurueck } from '../middleware/locals.js';
import { listeRollen, rolleName } from '../../bot/services/role.service.js';
import { mitgliederMitRolle } from '../../bot/services/member.service.js';
import { sendeVorlagenDM } from '../../bot/services/messaging.service.js';
import { starteAuftrag } from '../../bot/services/sendQueue.js';
import { limits } from '../security.js';

const eingabe = z.object({
  roleId: z.string().min(1, 'Bitte eine Rolle wählen'),
  title: z.string().max(256).default(''),
  body: z.string().min(1, 'Bitte einen Text eingeben').max(3000),
  templateId: z.string().optional().transform((v) => (v ? Number(v) : null)),
  autoSend: z.coerce.boolean().default(false),
  enabled: z.coerce.boolean().default(true),
});

export function roleMessagesRoutes({ repos, config, log, getKontext }) {
  const router = express.Router();

  router.get('/rollen-nachrichten', (req, res) => {
    const { guild } = getKontext();
    res.render('role-messages', {
      titel: 'Rollen-Nachrichten',
      nachrichten: repos.roleMessages.all(config.GUILD_ID).map((n) => ({
        ...n,
        roleName: guild ? rolleName(guild, n.roleId) : n.roleId,
        vorlageName: n.templateId
          ? (repos.templates.byId(config.GUILD_ID, n.templateId)?.name ?? 'gelöscht')
          : null,
        empfaengerZahl: guild ? mitgliederMitRolle(guild, n.roleId).length : 0,
      })),
      rollen: guild ? listeRollen(guild) : [],
      vorlagen: repos.templates.all(config.GUILD_ID),
    });
  });

  router.post('/rollen-nachrichten', validate(eingabe), (req, res) => {
    repos.roleMessages.create(config.GUILD_ID, req.geprueft);
    return flashUndZurueck(req, res, 'erfolg', 'Rollen-Nachricht gespeichert.', '/rollen-nachrichten');
  });

  router.post('/rollen-nachrichten/:id/loeschen', (req, res) => {
    repos.roleMessages.delete(config.GUILD_ID, Number(req.params.id));
    return flashUndZurueck(req, res, 'erfolg', 'Rollen-Nachricht gelöscht.', '/rollen-nachrichten');
  });

  /** Jetzt an alle Mitglieder mit dieser Rolle senden. */
  router.post('/rollen-nachrichten/:id/senden', limits.versand, (req, res) => {
    const { guild, client } = getKontext();
    if (!guild) return flashUndZurueck(req, res, 'fehler', 'Der Bot ist nicht mit dem Server verbunden.', '/rollen-nachrichten');

    const nachricht = repos.roleMessages.byId(config.GUILD_ID, Number(req.params.id));
    if (!nachricht) return flashUndZurueck(req, res, 'fehler', 'Nachricht nicht gefunden.', '/rollen-nachrichten');

    const empfaenger = mitgliederMitRolle(guild, nachricht.roleId);
    if (empfaenger.length === 0) {
      return flashUndZurueck(req, res, 'warnung', 'Kein Mitglied hat diese Rolle.', '/rollen-nachrichten');
    }
    if (empfaenger.length > config.DM_MAX_RECIPIENTS) {
      return flashUndZurueck(
        req, res, 'fehler',
        `Zu viele Empfänger (${empfaenger.length}). Erlaubt sind höchstens ${config.DM_MAX_RECIPIENTS}.`,
        '/rollen-nachrichten',
      );
    }

    const actorId = req.session.user.id;
    const auftragId = starteAuftrag(
      empfaenger,
      async (e) => {
        const member = guild.members.cache.get(e.id);
        if (!member) return { ok: false, grund: 'Mitglied nicht gefunden', label: e.displayName };
        const r = await sendeVorlagenDM({
          client, guild, member,
          templateId: nachricht.templateId,
          titel: nachricht.title,
          text: nachricht.body,
          kind: 'role_dm',
          actorId,
          zusatz: { role: rolleName(guild, nachricht.roleId) },
          repos, config,
        });
        return { ok: r.ok, grund: r.grund, label: member.displayName };
      },
      { delayMs: config.DM_DELAY_MS, titel: `Rollen-Nachricht an ${empfaenger.length} Mitglied(er)` },
    );

    log.info({ auftragId, anzahl: empfaenger.length, actorId }, 'Rollen-Nachricht-Versand gestartet');
    return res.redirect(`/dm/auftrag/${auftragId}`);
  });

  return router;
}
