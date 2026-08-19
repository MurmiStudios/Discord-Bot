import express from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { LOG_ARTEN } from '../../db/repos/log.repo.js';

const abfrage = z.object({
  seite: z.coerce.number().int().min(1).default(1),
  art: z.enum(LOG_ARTEN).nullable().catch(null).default(null),
});

export function logsRoutes({ repos, config }) {
  const router = express.Router();
  const PRO_SEITE = 50;

  router.get('/protokoll', validate(abfrage, 'query'), (req, res) => {
    const { seite, art } = req.geprueft;
    const gesamt = repos.log.count(config.GUILD_ID, art);
    const seiten = Math.max(1, Math.ceil(gesamt / PRO_SEITE));
    const aktuelleSeite = Math.min(seite, seiten);

    res.render('logs', {
      titel: 'Protokoll',
      eintraege: repos.log.recent(config.GUILD_ID, {
        limit: PRO_SEITE,
        offset: (aktuelleSeite - 1) * PRO_SEITE,
        kind: art,
      }),
      seite: aktuelleSeite,
      seiten,
      gesamt,
      art,
      arten: LOG_ARTEN,
    });
  });

  return router;
}
