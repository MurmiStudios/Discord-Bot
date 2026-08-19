import express from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { flashUndZurueck } from '../middleware/locals.js';
import { listeRollen, rolleName } from '../../bot/services/role.service.js';

const eingabe = z.object({
  triggerRoleId: z.string().min(1, 'Bitte die auslösende Rolle wählen'),
  // Optional mit leerem Standard: fehlt die Auswahl ganz, soll die
  // verständliche Meldung aus der Route greifen und nicht die generische
  // Schema-Fehlerseite.
  removeRoleIds: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]).filter(Boolean)),
  note: z.string().max(200).default(''),
  enabled: z.coerce.boolean().default(false),
});

export function roleRulesRoutes({ repos, config, getKontext }) {
  const router = express.Router();

  function seite(res, extras = {}) {
    const { guild } = getKontext();
    const rollen = guild ? listeRollen(guild) : [];
    const regeln = repos.roleRules.all(config.GUILD_ID).map((r) => ({
      ...r,
      triggerName: guild ? rolleName(guild, r.triggerRoleId) : r.triggerRoleId,
      entfernenNamen: r.removeRoleIds.map((id) => (guild ? rolleName(guild, id) : id)),
      // Warnen, sobald eine der beteiligten Rollen zur Laufzeit scheitern würde.
      warnungen: r.removeRoleIds
        .map((id) => rollen.find((x) => x.id === id))
        .filter((x) => x && !x.verwaltbar)
        .map((x) => `„${x.name}“: ${x.grund}`),
    }));

    res.render('role-rules', {
      titel: 'Rollenregeln',
      regeln,
      rollen,
      nichtVerwaltbar: rollen.filter((r) => !r.verwaltbar).length,
      ...extras,
    });
  }

  router.get('/rollenregeln', (req, res) => seite(res));

  router.post('/rollenregeln', validate(eingabe), (req, res) => {
    const { triggerRoleId, removeRoleIds, note, enabled } = req.geprueft;

    if (removeRoleIds.length === 0) {
      return flashUndZurueck(req, res, 'fehler', 'Bitte wähle mindestens eine zu entfernende Rolle.', '/rollenregeln');
    }
    // Eine Regel, die ihre eigene Auslöserrolle entfernt, wäre wirkungslos:
    // die Auswertung schützt gerade vergebene Rollen grundsätzlich.
    if (removeRoleIds.includes(triggerRoleId)) {
      return flashUndZurueck(
        req, res, 'fehler',
        'Die auslösende Rolle kann nicht gleichzeitig entfernt werden — eine gerade vergebene Rolle wird nie entzogen.',
        '/rollenregeln',
      );
    }

    repos.roleRules.create(config.GUILD_ID, { triggerRoleId, removeRoleIds, note, enabled });
    const { guild } = getKontext();
    return flashUndZurueck(
      req, res, 'erfolg',
      `Regel angelegt: Wer „${guild ? rolleName(guild, triggerRoleId) : triggerRoleId}“ erhält, ` +
        `verliert ${removeRoleIds.map((id) => `„${guild ? rolleName(guild, id) : id}“`).join(', ')}.`,
      '/rollenregeln',
    );
  });

  router.post('/rollenregeln/:id/umschalten', (req, res) => {
    const id = Number(req.params.id);
    const regel = repos.roleRules.byId(config.GUILD_ID, id);
    if (!regel) return flashUndZurueck(req, res, 'fehler', 'Regel nicht gefunden.', '/rollenregeln');

    repos.roleRules.setEnabled(config.GUILD_ID, id, !regel.enabled);
    return flashUndZurueck(
      req, res, 'erfolg',
      regel.enabled ? 'Regel deaktiviert.' : 'Regel aktiviert.',
      '/rollenregeln',
    );
  });

  router.post('/rollenregeln/:id/loeschen', (req, res) => {
    repos.roleRules.delete(config.GUILD_ID, Number(req.params.id));
    return flashUndZurueck(req, res, 'erfolg', 'Regel gelöscht.', '/rollenregeln');
  });

  return router;
}
