import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { flashUndZurueck } from '../middleware/locals.js';
import { baueUpload, speichereHintergrund, loescheHintergrund } from '../middleware/upload.js';
import { templateInputSchema, templateConfigSchema, DEFAULT_TEMPLATE, MIN_CANVAS, MAX_CANVAS } from '../../images/templateSchema.js';
import { renderCard, vorlageAusDatensatz } from '../../images/renderer.js';
import { avatarUrl, mitgliedAusCache } from '../../bot/services/member.service.js';
import { limits, csrf } from '../security.js';

/** Der Editor schickt den ungespeicherten Stand als JSON. */
const vorschauEingabe = z.object({
  templateId: z.coerce.number().int().optional().nullable(),
  width: z.coerce.number().int().min(MIN_CANVAS).max(MAX_CANVAS).default(1000),
  height: z.coerce.number().int().min(MIN_CANVAS).max(MAX_CANVAS).default(400),
  config: templateConfigSchema.prefault({}),
  userId: z.string().optional().nullable(),
});

const BEISPIEL = { displayName: 'Max Mustermann', username: 'max_mustermann', avatarUrl: null };

export function templateRoutes({ repos, config, getKontext }) {
  const router = express.Router();
  const upload = baueUpload(config);

  /** Hintergrundbilder nur für angemeldete Nutzer — nicht über express.static. */
  router.get('/vorlagen/hintergrund/:datei', (req, res) => {
    // basename verhindert, dass über ../ aus dem Verzeichnis ausgebrochen wird.
    const datei = path.basename(req.params.datei);
    const voll = path.join(config.uploadsDir, datei);
    if (!fs.existsSync(voll)) return res.status(404).end();
    return res.sendFile(voll);
  });

  router.get('/vorlagen', (req, res) => {
    res.render('templates/index', {
      titel: 'Bildvorlagen',
      vorlagen: repos.templates.all(config.GUILD_ID),
    });
  });

  router.get('/vorlagen/neu', (req, res) => {
    const { guild } = getKontext();
    res.render('templates/edit', {
      titel: 'Neue Bildvorlage',
      vorlage: { id: null, name: '', kind: 'welcome', ...DEFAULT_TEMPLATE },
      mitglieder: guild ? [...guild.members.cache.values()].filter((m) => !m.user.bot).slice(0, 100).map((m) => ({ id: m.id, displayName: m.displayName })) : [],
      seitenSkript: 'template-editor.js',
    });
  });

  router.get('/vorlagen/:id', (req, res) => {
    const vorlage = repos.templates.byId(config.GUILD_ID, Number(req.params.id));
    if (!vorlage) {
      return res.status(404).render('error', {
        titel: 'Vorlage nicht gefunden', nachricht: 'Diese Bildvorlage existiert nicht.', zeigeAbmelden: true,
      });
    }
    const { guild } = getKontext();
    return res.render('templates/edit', {
      titel: `Vorlage: ${vorlage.name}`,
      vorlage,
      mitglieder: guild ? [...guild.members.cache.values()].filter((m) => !m.user.bot).slice(0, 100).map((m) => ({ id: m.id, displayName: m.displayName })) : [],
      seitenSkript: 'template-editor.js',
    });
  });

  // Reihenfolge beachten: multer muss den Body gelesen haben, bevor die
  // CSRF-Prüfung darin nach dem Token suchen kann. Die globale Prüfung in
  // server.js überspringt multipart-Anfragen genau deshalb.
  router.post(
    '/vorlagen',
    upload.single('hintergrund'),
    csrf.csrfSynchronisedProtection,
    async (req, res, next) => {
    try {
      // config kommt als JSON-Zeichenkette aus dem Editor.
      const roh = { ...req.body };
      if (typeof roh.config === 'string') {
        try {
          roh.config = JSON.parse(roh.config);
        } catch {
          return flashUndZurueck(req, res, 'fehler', 'Die Layout-Daten waren fehlerhaft.', '/vorlagen');
        }
      }

      const geprueft = templateInputSchema.safeParse(roh);
      if (!geprueft.success) {
        return flashUndZurueck(
          req, res, 'fehler',
          geprueft.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · '),
          '/vorlagen',
        );
      }

      const id = req.body.id ? Number(req.body.id) : null;
      const bestehend = id ? repos.templates.byId(config.GUILD_ID, id) : null;
      let hintergrundDatei = bestehend?.backgroundFile ?? null;

      if (req.file) {
        const gespeichert = await speichereHintergrund(req.file, config);
        if (!gespeichert.ok) return flashUndZurueck(req, res, 'fehler', gespeichert.grund, '/vorlagen');
        // Alten Hintergrund erst löschen, wenn der neue sicher liegt.
        if (hintergrundDatei) loescheHintergrund(hintergrundDatei, config);
        hintergrundDatei = gespeichert.dateiname;
      } else if (req.body.hintergrundEntfernen === 'on' && hintergrundDatei) {
        loescheHintergrund(hintergrundDatei, config);
        hintergrundDatei = null;
      }

      const daten = { ...geprueft.data, backgroundFile: hintergrundDatei };

      if (bestehend) {
        repos.templates.update(config.GUILD_ID, id, daten);
        return flashUndZurueck(req, res, 'erfolg', `Vorlage „${daten.name}“ gespeichert.`, `/vorlagen/${id}`);
      }

      const neu = repos.templates.create(config.GUILD_ID, daten);
      return flashUndZurueck(req, res, 'erfolg', `Vorlage „${neu.name}“ angelegt.`, `/vorlagen/${neu.id}`);
    } catch (err) {
      // Ein doppelter Name verletzt die UNIQUE-Bedingung.
      if (String(err?.message).includes('UNIQUE')) {
        return flashUndZurueck(req, res, 'fehler', 'Es gibt bereits eine Vorlage mit diesem Namen.', '/vorlagen');
      }
      return next(err);
    }
  },
  );

  router.post('/vorlagen/:id/loeschen', (req, res) => {
    const id = Number(req.params.id);
    const vorlage = repos.templates.byId(config.GUILD_ID, id);
    if (vorlage?.backgroundFile) loescheHintergrund(vorlage.backgroundFile, config);
    repos.templates.delete(config.GUILD_ID, id);
    return flashUndZurueck(req, res, 'erfolg', 'Vorlage gelöscht.', '/vorlagen');
  });

  /**
   * Live-Vorschau. Rendert mit demselben Renderer wie der Versand — deshalb
   * kann die Vorschau nicht vom Ergebnis abweichen.
   */
  router.post('/vorlagen/vorschau.png', limits.vorschau, validate(vorschauEingabe), async (req, res) => {
    const { templateId, width, height, config: layout, userId } = req.geprueft;
    const { guild } = getKontext();

    // Hintergrund stammt aus der gespeicherten Vorlage — er wird separat
    // hochgeladen und ist im ungespeicherten Editor-Stand nicht enthalten.
    const gespeichert = templateId ? repos.templates.byId(config.GUILD_ID, templateId) : null;

    let nutzer = BEISPIEL;
    if (userId && guild) {
      const m = guild.members.cache.get(userId);
      if (m) nutzer = { displayName: m.displayName, username: m.user.username, avatarUrl: avatarUrl(m) };
    }

    try {
      const { buffer } = await renderCard(
        {
          width,
          height,
          backgroundPath: gespeichert?.backgroundFile
            ? path.join(config.uploadsDir, gespeichert.backgroundFile)
            : null,
          config: layout,
        },
        nutzer,
        { guild: guild?.name ?? 'Beispielserver', role: 'Beispielrolle', count: guild?.memberCount ?? 42 },
      );

      res.type('png').set('Cache-Control', 'no-store').send(buffer);
    } catch (err) {
      res.status(500).json({ ok: false, fehler: err.message });
    }
  });

  return router;
}
