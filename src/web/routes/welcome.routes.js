import express from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { flashUndZurueck } from '../middleware/locals.js';
import { sendeVorlagenDM } from '../../bot/services/messaging.service.js';
import { limits } from '../security.js';

const eingabe = z.object({
  enabled: z.coerce.boolean().default(false),
  title: z.string().max(256).default(''),
  body: z.string().max(3000).default(''),
  templateId: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null)),
});

export function welcomeRoutes({ repos, config, getKontext }) {
  const router = express.Router();

  router.get('/willkommen', (req, res) => {
    res.render('welcome', {
      titel: 'Willkommensnachricht',
      einstellungen: {
        enabled: repos.settings.get('welcome.enabled', false),
        title: repos.settings.get('welcome.title', ''),
        body: repos.settings.get('welcome.body', 'Hallo {user}, schön dass du da bist!'),
        templateId: repos.settings.get('welcome.template_id', null),
      },
      vorlagen: repos.templates.all(config.GUILD_ID),
    });
  });

  router.post('/willkommen', validate(eingabe), (req, res) => {
    const { enabled, title, body, templateId } = req.geprueft;

    if (enabled && !title && !body.trim() && !templateId) {
      return flashUndZurueck(
        req, res, 'fehler',
        'Die Willkommensnachricht ist aktiv, hat aber keinen Inhalt. Bitte Text oder Bildvorlage angeben.',
        '/willkommen',
      );
    }

    repos.settings.setMany({
      'welcome.enabled': enabled,
      'welcome.title': title,
      'welcome.body': body,
      'welcome.template_id': templateId,
    });

    return flashUndZurueck(
      req, res, 'erfolg',
      enabled ? 'Willkommensnachricht gespeichert und aktiv.' : 'Willkommensnachricht gespeichert (derzeit deaktiviert).',
      '/willkommen',
    );
  });

  /** Test-DM an den angemeldeten Nutzer — prüft Text, Bild und Zustellbarkeit. */
  router.post('/willkommen/test', limits.versand, async (req, res) => {
    const { guild, client } = getKontext();
    if (!guild) return flashUndZurueck(req, res, 'fehler', 'Der Bot ist nicht mit dem Server verbunden.', '/willkommen');

    const member = guild.members.cache.get(req.session.user.id);
    if (!member) {
      return flashUndZurueck(req, res, 'fehler', 'Du bist kein Mitglied dieses Servers — Test nicht möglich.', '/willkommen');
    }

    const ergebnis = await sendeVorlagenDM({
      client, guild, member,
      templateId: repos.settings.get('welcome.template_id', null),
      titel: repos.settings.get('welcome.title', ''),
      text: repos.settings.get('welcome.body', ''),
      kind: 'welcome_dm',
      actorId: req.session.user.id,
      repos, config,
    });

    return flashUndZurueck(
      req, res,
      ergebnis.ok ? 'erfolg' : 'fehler',
      ergebnis.ok
        ? `Test-DM wurde an dich gesendet.${ergebnis.hinweise.length ? ' ' + ergebnis.hinweise.join(' ') : ''}`
        : `Test-DM fehlgeschlagen: ${ergebnis.grund}`,
      '/willkommen',
    );
  });

  return router;
}
