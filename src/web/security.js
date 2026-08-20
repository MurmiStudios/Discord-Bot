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
        // Nur setzen, wenn wirklich über HTTPS ausgeliefert wird. Über HTTP
        // würde der Browser ein Secure-Cookie nicht mitsenden — die Anmeldung
        // schlüge fehl, ohne dass eine Fehlermeldung erschiene.
        secure: config.isProduction && !config.unverschluesselt,
        maxAge: 12 * 60 * 60 * 1000,
      },
    }),
  };
}

/** Discords Profilbilder liegen auf diesem CDN. */
const DISCORD_CDN = 'https://cdn.discordapp.com';

export function baueHelmet(config) {
  return helmet({
    contentSecurityPolicy: {
      // Die Richtlinie wird bewusst VOLLSTÄNDIG ausgeschrieben. Mit Helmets
      // Standardwerten käme sonst still `upgrade-insecure-requests` dazu — und
      // das weist den Browser an, jede Unterressource von http:// auf https://
      // umzuschreiben. Beim Betrieb ohne TLS scheitern dadurch Stylesheet und
      // Skripte lautlos, und das Panel erscheint als nacktes HTML.
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        // Keine Inline-Skripte — sämtliches Panel-JavaScript liegt in Dateien.
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        // blob: für die Live-Vorschau, data: für kleine Symbole,
        // das CDN für die Profilbilder in der Seitenleiste.
        imgSrc: ["'self'", 'blob:', 'data:', DISCORD_CDN],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        formAction: ["'self'", 'https://discord.com'],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        // Nur sinnvoll, wenn tatsächlich über HTTPS ausgeliefert wird.
        ...(config.unverschluesselt ? {} : { upgradeInsecureRequests: [] }),
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
