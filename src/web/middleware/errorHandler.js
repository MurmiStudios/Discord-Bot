/**
 * 404 und zentrale Fehlerbehandlung.
 *
 * Wichtig: In der Produktion darf niemals ein Stacktrace an den Browser gehen —
 * er kann Pfade und Konfigurationsdetails verraten.
 */
import { csrf } from '../security.js';

export function notFound(req, res) {
  res.status(404).render('error', {
    titel: 'Seite nicht gefunden',
    nachricht: `Die Adresse „${req.path}“ gibt es nicht.`,
    zeigeAbmelden: false,
  });
}

export function errorHandler(log, config) {
  // Express erkennt den Fehlerbehandler an der Vier-Argumente-Signatur.
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, _next) => {
    if (err === csrf.invalidCsrfTokenError || err?.code === 'EBADCSRFTOKEN') {
      log.warn({ pfad: req.path }, 'CSRF-Token ungültig');
      return res.status(403).render('error', {
        titel: 'Sicherheitsprüfung fehlgeschlagen',
        nachricht:
          'Das Formular war zu lange geöffnet oder stammt nicht von dieser Seite. ' +
          'Bitte lade die Seite neu und versuche es erneut.',
        zeigeAbmelden: false,
      });
    }

    if (err?.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).render('error', {
        titel: 'Datei zu gross',
        nachricht: `Die Datei überschreitet das Limit von ${config.MAX_UPLOAD_MB} MB.`,
        zeigeAbmelden: false,
      });
    }

    log.error({ err, pfad: req.path }, 'Unbehandelter Fehler');
    return res.status(500).render('error', {
      titel: 'Unerwarteter Fehler',
      nachricht: config.isProduction
        ? 'Es ist ein Fehler aufgetreten. Details stehen im Server-Protokoll.'
        : String(err?.stack ?? err),
      zeigeAbmelden: false,
    });
  };
}
