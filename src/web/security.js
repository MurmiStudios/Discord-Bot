/**
 * Sicherheits-Middleware: Kopfzeilen, Sitzungen, CSRF, Rate-Limits.
 */
import session from 'express-session';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { csrfSync } from 'csrf-sync';
import { createSqliteStore } from './sessionStore.js';

export function baueSession(db, config) {
  const store = createSqliteStore(db);
  return {
    store,
    middleware: session({
      name: 'panel.sid',
      secret: config.SESSION_SECRET,
      store,
      resave: false,
      saveUninitialized: false,
      rolling: true, // Sitzung verlängert sich bei Aktivität
      cookie: {
        httpOnly: true,
        // 'lax' ist Pflicht: bei 'strict' schickt der Browser das Cookie beim
        // Rücksprung von Discord nicht mit und die Anmeldung schlägt fehl.
        sameSite: 'lax',
        secure: config.isProduction,
        maxAge: 12 * 60 * 60 * 1000,
      },
    }),
  };
}

export function baueHelmet() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Keine Inline-Skripte — sämtliches Panel-JavaScript liegt in Dateien.
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        // blob: wird für die Live-Vorschau gebraucht, data: für kleine Symbole.
        imgSrc: ["'self'", 'blob:', 'data:'],
        connectSrc: ["'self'"],
        formAction: ["'self'", 'https://discord.com'],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    // Der Rücksprung von Discord würde sonst als Cross-Origin blockiert.
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  });
}

export const csrf = csrfSync({
  getTokenFromRequest: (req) => req.body?._csrf ?? req.headers['x-csrf-token'],
});

const limiter = (max, fensterMin, nachricht) =>
  rateLimit({
    windowMs: fensterMin * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: nachricht,
    handler: (req, res) =>
      res.status(429).render('error', {
        titel: 'Zu viele Anfragen',
        nachricht,
        zeigeAbmelden: false,
      }),
  });

export const limits = {
  global: limiter(300, 15, 'Zu viele Anfragen. Bitte warte einen Moment.'),
  auth: limiter(20, 15, 'Zu viele Anmeldeversuche. Bitte warte einen Moment.'),
  versand: limiter(10, 1, 'Zu viele Versandvorgänge in kurzer Zeit. Bitte kurz warten.'),
  vorschau: limiter(60, 1, 'Zu viele Vorschau-Anfragen.'),
};
