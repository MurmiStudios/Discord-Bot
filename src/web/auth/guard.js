/**
 * Zugriffsschutz fürs Panel.
 *
 * Die Berechtigung wird bei jeder Anfrage neu geprüft (kurz zwischengespeichert),
 * nicht nur einmal beim Anmelden. Wird jemandem die Admin-Rolle entzogen, ist
 * er dadurch sofort ausgesperrt und nicht erst, wenn seine Sitzung abläuft.
 */
import { PermissionFlagsBits } from 'discord.js';

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map();

export function leereZugriffsCache(userId = null) {
  if (userId) cache.delete(userId);
  else cache.clear();
}

/**
 * @returns {{erlaubt:boolean, grund:string, rolle:string}}
 */
export function pruefeZugriff(userId, { guild, config }) {
  if (config.PANEL_ADMIN_IDS.includes(userId)) {
    return { erlaubt: true, grund: '', rolle: 'Panel-Administrator' };
  }

  if (!guild) {
    return {
      erlaubt: false,
      grund: 'Der Bot ist noch nicht mit dem Server verbunden — bitte später erneut versuchen.',
      rolle: '',
    };
  }

  const member = guild.members.cache.get(userId);
  if (!member) {
    return { erlaubt: false, grund: 'Du bist kein Mitglied dieses Servers.', rolle: '' };
  }

  if (config.PANEL_REQUIRE_GUILD_ADMIN && member.permissions.has(PermissionFlagsBits.Administrator)) {
    return { erlaubt: true, grund: '', rolle: 'Server-Administrator' };
  }

  const erlaubteRolle = config.PANEL_ALLOWED_ROLE_IDS.find((r) => member.roles.cache.has(r));
  if (erlaubteRolle) {
    return {
      erlaubt: true,
      grund: '',
      rolle: guild.roles.cache.get(erlaubteRolle)?.name ?? 'Berechtigte Rolle',
    };
  }

  return {
    erlaubt: false,
    grund: 'Dein Discord-Konto ist für dieses Panel nicht freigeschaltet.',
    rolle: '',
  };
}

function zwischengespeichertePruefung(userId, kontext) {
  const e = cache.get(userId);
  if (e && Date.now() - e.zeit < CACHE_TTL_MS) return e.ergebnis;
  const ergebnis = pruefeZugriff(userId, kontext);
  cache.set(userId, { ergebnis, zeit: Date.now() });
  return ergebnis;
}

/** Leitet nicht angemeldete Besucher zur Anmeldung um. */
export function requireLogin(req, res, next) {
  if (req.session?.user) return next();
  // Ziel merken, damit man nach der Anmeldung dort landet, wo man hinwollte.
  req.session.returnTo = req.originalUrl;
  return res.redirect('/login');
}

/** Prüft zusätzlich, ob das Konto fürs Panel freigeschaltet ist. */
export function requirePanelAccess(getKontext) {
  return (req, res, next) => {
    if (!req.session?.user) {
      req.session.returnTo = req.originalUrl;
      return res.redirect('/login');
    }

    const kontext = getKontext();
    const { erlaubt, grund, rolle } = zwischengespeichertePruefung(req.session.user.id, kontext);

    if (!erlaubt) {
      kontext.repos?.log.add(kontext.config.GUILD_ID, {
        kind: 'auth',
        status: 'failed',
        actorId: req.session.user.id,
        detail: `Zugriff verweigert: ${grund}`,
      });
      return res.status(403).render('error', {
        titel: 'Kein Zugriff',
        nachricht: grund,
        zeigeAbmelden: true,
      });
    }

    // Direkt in res.locals, nicht in req: die locals-Middleware läuft VOR
    // diesem Guard und käme sonst zu früh — die Rolle bliebe in der Ansicht leer.
    req.panelRolle = rolle;
    res.locals.panelRolle = rolle;
    return next();
  };
}
