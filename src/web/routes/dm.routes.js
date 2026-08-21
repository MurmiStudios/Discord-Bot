import express from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { flashUndZurueck } from '../middleware/locals.js';
import { sucheMitglieder, mitgliederMitRolle } from '../../bot/services/member.service.js';
import { listeRollen } from '../../bot/services/role.service.js';
import { sendeVorlagenDM } from '../../bot/services/messaging.service.js';
import { starteAuftrag, holeAuftrag } from '../../bot/services/sendQueue.js';
import { limits } from '../security.js';

const eingabe = z.object({
  empfaenger: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]).filter(Boolean)),
  title: z.string().max(256).default(''),
  content: z.string().max(3000).default(''),
  templateId: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || Number.isInteger(v), 'Ungültige Vorlage'),
});

export function dmRoutes({ repos, config, log, getKontext }) {
  const router = express.Router();

  router.get('/dm', (req, res) => {
    const { guild } = getKontext();
    res.render('dm', {
      titel: 'Direktnachricht',
      mitglieder: guild ? sucheMitglieder(guild, '', 500) : [],
      rollen: guild ? listeRollen(guild) : [],
      vorlagen: repos.templates.all(config.GUILD_ID),
      maxEmpfaenger: config.DM_MAX_RECIPIENTS,
      seitenSkript: 'member-picker.js',
    });
  });

  /** Suchendpunkt für die Mitgliederauswahl im Browser. */
  router.get('/api/mitglieder', (req, res) => {
    const { guild } = getKontext();
    if (!guild) return res.json([]);
    return res.json(sucheMitglieder(guild, String(req.query.q ?? ''), 50));
  });

  /** Mitglieder einer Rolle — für "alle mit Rolle X anschreiben". */
  router.get('/api/rolle/:roleId/mitglieder', (req, res) => {
    const { guild } = getKontext();
    if (!guild) return res.json([]);
    return res.json(mitgliederMitRolle(guild, req.params.roleId));
  });

  router.post('/dm', limits.versand, validate(eingabe), (req, res) => {
    const { guild, client } = getKontext();
    if (!guild) return flashUndZurueck(req, res, 'fehler', 'Der Bot ist nicht mit dem Server verbunden.', '/dm');

    const { empfaenger, title, content, templateId } = req.geprueft;

    if (empfaenger.length === 0) {
      return flashUndZurueck(req, res, 'fehler', 'Bitte wähle mindestens einen Empfänger.', '/dm');
    }
    if (empfaenger.length > config.DM_MAX_RECIPIENTS) {
      return flashUndZurueck(
        req, res, 'fehler',
        `Zu viele Empfänger (${empfaenger.length}). Erlaubt sind höchstens ${config.DM_MAX_RECIPIENTS}.`,
        '/dm',
      );
    }
    if (!content.trim() && !title && !templateId) {
      return flashUndZurueck(req, res, 'fehler', 'Die Nachricht ist leer.', '/dm');
    }

    const actorId = req.session.user.id;
    const auftragId = starteAuftrag(
      empfaenger,
      async (userId) => {
        const member = guild.members.cache.get(userId);
        if (!member) return { ok: false, grund: 'Mitglied nicht gefunden', label: userId };

        const r = await sendeVorlagenDM({
          client, guild, member, templateId, titel: title, text: content,
          kind: 'dm', actorId, repos, config,
        });
        return { ok: r.ok, grund: r.grund, label: member.displayName };
      },
      { delayMs: config.DM_DELAY_MS, titel: `DM an ${empfaenger.length} Mitglied(er)` },
    );

    log.info({ auftragId, anzahl: empfaenger.length, actorId }, 'DM-Versand gestartet');
    return res.redirect(`/dm/auftrag/${auftragId}`);
  });

  router.get('/dm/auftrag/:id', (req, res) => {
    const auftrag = holeAuftrag(req.params.id);
    if (!auftrag) {
      return res.status(404).render('error', {
        titel: 'Auftrag nicht gefunden',
        nachricht: 'Der Versandauftrag ist abgelaufen oder existiert nicht.',
        zeigeAbmelden: false,
      });
    }
    return res.render('dm-auftrag', { titel: 'Versandergebnis', auftrag });
  });

  /** Fortschritt für das automatische Nachladen im Browser. */
  router.get('/api/auftrag/:id', (req, res) => {
    const auftrag = holeAuftrag(req.params.id);
    if (!auftrag) return res.status(404).json({ fehler: 'unbekannt' });
    return res.json(auftrag);
  });

  return router;
}
