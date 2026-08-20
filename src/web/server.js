/**
 * Zusammenbau der Express-Anwendung.
 *
 * Die Reihenfolge der Middleware ist wichtig:
 *   Rate-Limit → Helmet → statische Dateien → Body-Parser → Sitzung →
 *   locals (braucht die Sitzung) → Anmelde-Routen → Zugriffsschutz →
 *   Panel-Routen → 404 → Fehlerbehandlung
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

import { baueSession, baueHelmet, limits, csrf } from './security.js';
import { locals } from './middleware/locals.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { authRoutes } from './auth/routes.auth.js';
import { requirePanelAccess } from './auth/guard.js';
import { panelRoutes } from './routes/index.js';

const hier = path.dirname(fileURLToPath(import.meta.url));

/**
 * EJS kennt keine Layouts. Diese Middleware ersetzt res.render so, dass die
 * Ansicht zuerst zu HTML gerendert und dann in layout.ejs eingesetzt wird.
 */
function layoutMiddleware(app) {
  return (req, res, next) => {
    const original = res.render.bind(res);
    res.render = (ansicht, daten = {}, cb) => {
      if (cb) return original(ansicht, daten, cb);
      return app.render(ansicht, { ...res.locals, ...daten }, (err, html) => {
        if (err) return next(err);
        return original('layout', { ...daten, koerper: html });
      });
    };
    next();
  };
}

export function createServer({ db, repos, config, log, getKontext }) {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(hier, 'views'));
  // Ohne dies zählt hinter einem Reverse-Proxy jede Anfrage auf dieselbe IP,
  // und Secure-Cookies würden fälschlich als unsicher gelten.
  app.set('trust proxy', config.TRUST_PROXY ? 1 : false);
  app.disable('x-powered-by');

  app.use(limits.global);
  app.use(baueHelmet(config));
  app.use(express.static(path.join(hier, 'public'), { maxAge: '1h' }));
  app.use(express.urlencoded({ extended: false, limit: '256kb' }));
  app.use(express.json({ limit: '256kb' }));

  const { middleware: sessionMw, store } = baueSession(db, config);
  app.use(sessionMw);
  app.use(layoutMiddleware(app));
  app.use(locals(getKontext));

  // Anmelde-Routen liegen vor dem Zugriffsschutz — sonst käme man nie hinein.
  app.use(authRoutes({ config, getKontext, log }));

  // Ab hier: angemeldet, freigeschaltet und CSRF-geschützt.
  app.use(requirePanelAccess(getKontext));

  // CSRF-Prüfung. Bei multipart/form-data ist req.body an dieser Stelle noch
  // leer — den Body liest erst multer in der jeweiligen Route. Solche
  // Anfragen werden hier übersprungen und in der Route direkt NACH multer
  // geprüft (siehe templates.routes.js).
  app.use((req, res, next) => {
    if (req.is('multipart/form-data')) return next();
    return csrf.csrfSynchronisedProtection(req, res, next);
  });

  app.use(panelRoutes({ repos, config, log, getKontext }));

  app.use(notFound);
  app.use(errorHandler(log, config));

  return { app, store };
}
