import express from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { flashUndZurueck } from '../middleware/locals.js';
import { listeRollen, rolleName } from '../../bot/services/role.service.js';
import { sucheMitglieder, mitgliedAusCache } from '../../bot/services/member.service.js';
import {
  setSchema,
  buttonSchema,
  aktionenSchema,
  beschreibeAktion,
  MAX_BUTTONS,
  STILE,
} from '../../bot/services/buttonActions.schema.js';

/**
 * Die Aktionen kommen als JSON-Zeichenkette aus dem Formular — anders liesse
 * sich eine geordnete Liste unterschiedlich geformter Einträge nicht sauber
 * über ein HTML-Formular übertragen.
 */
const buttonEingabe = buttonSchema.extend({
  actions: z
    .string()
    .default('[]')
    .transform((roh, ctx) => {
      try {
        return JSON.parse(roh);
      } catch {
        ctx.addIssue({ code: 'custom', message: 'Die Aktionsliste war fehlerhaft' });
        return z.NEVER;
      }
    })
    .pipe(aktionenSchema),
  allowedRoleIds: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]).filter(Boolean)),
});

export function buttonSetRoutes({ repos, config, getKontext }) {
  const router = express.Router();
  const G = config.GUILD_ID;

  /** Reichert eine Leiste mit lesbaren Namen an. */
  function leisteAufbereiten(set, guild) {
    const buttons = repos.buttonSets.buttons(set.id).map((b) => ({
      ...b,
      aktionText: b.actions.map((a) =>
        beschreibeAktion(a, {
          rolleName: (id) => rolleName(guild, id),
          mitgliedName: (id) => mitgliedAusCache(guild, id)?.displayName ?? id,
        }),
      ),
      rollenNamen: b.allowedRoleIds.map((id) => rolleName(guild, id)),
      nutzungen: repos.buttonSets.anzahlNutzungen(b.id),
    }));
    return { ...set, buttons };
  }

  router.get('/aktionsleisten', (req, res) => {
    const { guild } = getKontext();
    res.render('button-sets', {
      titel: 'Aktionsleisten',
      leisten: repos.buttonSets
        .alleSets(G)
        .map((s) => leisteAufbereiten(s, guild))
        .map((s) => ({ ...s, anzahl: s.buttons.length })),
    });
  });

  router.post('/aktionsleisten', validate(setSchema), (req, res) => {
    try {
      const set = repos.buttonSets.createSet(G, req.geprueft);
      return flashUndZurueck(req, res, 'erfolg', `Leiste „${set.name}“ angelegt.`, `/aktionsleisten/${set.id}`);
    } catch (err) {
      if (String(err?.message).includes('UNIQUE')) {
        return flashUndZurueck(req, res, 'fehler', 'Es gibt bereits eine Leiste mit diesem Namen.', '/aktionsleisten');
      }
      throw err;
    }
  });

  router.get('/aktionsleisten/:id', (req, res) => {
    const { guild } = getKontext();
    const set = repos.buttonSets.setById(G, Number(req.params.id));
    if (!set) {
      return res.status(404).render('error', {
        titel: 'Leiste nicht gefunden',
        nachricht: 'Diese Aktionsleiste existiert nicht.',
        zeigeAbmelden: false,
      });
    }

    return res.render('button-set-edit', {
      titel: `Aktionsleiste: ${set.name}`,
      leiste: leisteAufbereiten(set, guild),
      rollen: guild ? listeRollen(guild) : [],
      mitglieder: guild ? sucheMitglieder(guild, '', 200) : [],
      vorlagen: repos.templates.all(G),
      stile: STILE,
      maxButtons: MAX_BUTTONS,
      seitenSkript: 'button-editor.js',
    });
  });

  router.post('/aktionsleisten/:id', validate(setSchema), (req, res) => {
    const id = Number(req.params.id);
    repos.buttonSets.updateSet(G, id, req.geprueft);
    return flashUndZurueck(req, res, 'erfolg', 'Leiste gespeichert.', `/aktionsleisten/${id}`);
  });

  router.post('/aktionsleisten/:id/loeschen', (req, res) => {
    repos.buttonSets.deleteSet(G, Number(req.params.id));
    return flashUndZurueck(
      req, res, 'erfolg',
      'Leiste gelöscht. Bereits versendete Nachrichten behalten ihre Buttons — ' +
        'diese tun nun nichts mehr.',
      '/aktionsleisten',
    );
  });

  /* ── Buttons ──────────────────────────────────────────────────────── */

  router.post('/aktionsleisten/:id/buttons', validate(buttonEingabe), (req, res) => {
    const setId = Number(req.params.id);
    const zurueck = `/aktionsleisten/${setId}`;

    if (!repos.buttonSets.setById(G, setId)) {
      return flashUndZurueck(req, res, 'fehler', 'Leiste nicht gefunden.', '/aktionsleisten');
    }
    if (repos.buttonSets.anzahlImSet(setId) >= MAX_BUTTONS) {
      return flashUndZurueck(
        req, res, 'fehler',
        `Discord erlaubt höchstens ${MAX_BUTTONS} Buttons je Nachricht.`,
        zurueck,
      );
    }

    const b = repos.buttonSets.createButton(setId, req.geprueft);
    return flashUndZurueck(req, res, 'erfolg', `Button „${b.label}“ angelegt.`, zurueck);
  });

  router.post('/aktionsleisten/:id/buttons/:buttonId', validate(buttonEingabe), (req, res) => {
    const setId = Number(req.params.id);
    const button = repos.buttonSets.buttonById(Number(req.params.buttonId));

    // Sicherstellen, dass der Button wirklich zu dieser Leiste gehört — sonst
    // liesse sich über eine geänderte Adresse ein fremder Button bearbeiten.
    if (!button || button.setId !== setId) {
      return flashUndZurueck(req, res, 'fehler', 'Button nicht gefunden.', `/aktionsleisten/${setId}`);
    }

    repos.buttonSets.updateButton(button.id, req.geprueft);
    return flashUndZurueck(req, res, 'erfolg', 'Button gespeichert.', `/aktionsleisten/${setId}`);
  });

  router.post('/aktionsleisten/:id/buttons/:buttonId/loeschen', (req, res) => {
    const setId = Number(req.params.id);
    const button = repos.buttonSets.buttonById(Number(req.params.buttonId));
    if (button && button.setId === setId) repos.buttonSets.deleteButton(button.id);
    return flashUndZurueck(req, res, 'erfolg', 'Button gelöscht.', `/aktionsleisten/${setId}`);
  });

  /** Einmal-Sperre für alle Mitglieder aufheben. */
  router.post('/aktionsleisten/:id/buttons/:buttonId/zuruecksetzen', (req, res) => {
    const setId = Number(req.params.id);
    const button = repos.buttonSets.buttonById(Number(req.params.buttonId));
    if (!button || button.setId !== setId) {
      return flashUndZurueck(req, res, 'fehler', 'Button nicht gefunden.', `/aktionsleisten/${setId}`);
    }
    const n = repos.buttonSets.nutzungenZuruecksetzen(button.id);
    return flashUndZurueck(
      req, res, 'erfolg',
      `Sperre für ${n} Mitglied(er) aufgehoben — sie können den Button erneut benutzen.`,
      `/aktionsleisten/${setId}`,
    );
  });

  return router;
}
