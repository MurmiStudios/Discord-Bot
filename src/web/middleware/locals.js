/**
 * Stellt jeder Ansicht die immer benötigten Werte bereit: angemeldeter Nutzer,
 * CSRF-Token, Flash-Meldungen und der Name des verwalteten Servers.
 */
import { csrf } from '../security.js';
import { t, statusText } from '../i18n/de.js';

export function locals(getKontext) {
  return (req, res, next) => {
    const kontext = getKontext();

    res.locals.user = req.session?.user ?? null;
    res.locals.panelRolle = req.panelRolle ?? '';
    res.locals.guildName = kontext.guild?.name ?? 'Nicht verbunden';
    res.locals.botVerbunden = Boolean(kontext.guild);
    res.locals.aktuellerPfad = req.path;
    res.locals.t = t;
    res.locals.statusText = statusText;

    // Token nur erzeugen, wenn eine Sitzung existiert — sonst legt jeder
    // anonyme Aufruf eine neue Sitzung an.
    res.locals.csrfToken = req.session ? csrf.generateToken(req) : '';

    // Flash: einmalige Meldung über eine Weiterleitung hinweg.
    res.locals.flash = req.session?.flash ?? null;
    if (req.session?.flash) delete req.session.flash;

    res.locals.setFlash = null;
    next();
  };
}

/** Hilfsfunktion für Routen: Meldung setzen und weiterleiten. */
export function flashUndZurueck(req, res, art, text, ziel) {
  req.session.flash = { art, text };
  req.session.save(() => res.redirect(ziel));
}
