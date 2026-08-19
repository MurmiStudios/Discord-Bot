/**
 * Anmelde-Routen.
 *
 * Der state-Parameter wird in der Sitzung hinterlegt, genau einmal verwendet
 * und zeitkonstant verglichen. Nach erfolgreichem Tausch wird die Sitzung neu
 * erzeugt (Schutz gegen Session-Fixation) und das Zugriffstoken verworfen —
 * wir speichern es nirgends.
 */
import express from 'express';
import { buildAuthorizeUrl, erzeugeState, stateGleich, exchangeCode, fetchDiscordUser } from './oauth.js';
import { pruefeZugriff, leereZugriffsCache } from './guard.js';
import { limits } from '../security.js';

export function authRoutes({ config, getKontext, log }) {
  const router = express.Router();

  router.get('/login', limits.auth, (req, res) => {
    if (req.session.user) return res.redirect('/');

    const state = erzeugeState();
    req.session.oauthState = state;
    // Sitzung explizit speichern, bevor umgeleitet wird — sonst kann der
    // state beim Rücksprung noch nicht persistiert sein.
    req.session.save((err) => {
      if (err) {
        log.error({ err }, 'Sitzung konnte vor der Anmeldung nicht gespeichert werden');
        return res.status(500).render('error', {
          titel: 'Anmeldung nicht möglich',
          nachricht: 'Die Sitzung konnte nicht angelegt werden.',
          zeigeAbmelden: false,
        });
      }
      return res.render('login', {
        authUrl: buildAuthorizeUrl({
          clientId: config.DISCORD_CLIENT_ID,
          redirectUri: config.OAUTH_REDIRECT_URI,
          state,
        }),
      });
    });
  });

  router.get('/auth/callback', limits.auth, async (req, res) => {
    const fehlerSeite = (nachricht) =>
      res.status(400).render('error', { titel: 'Anmeldung fehlgeschlagen', nachricht, zeigeAbmelden: false });

    if (req.query.error) {
      return fehlerSeite(`Discord hat die Anmeldung abgebrochen: ${String(req.query.error_description ?? req.query.error)}`);
    }

    const { code, state } = req.query;
    const erwartet = req.session.oauthState;
    // state sofort verbrauchen — auch bei Fehlschlag, damit er nicht
    // wiederverwendet werden kann.
    delete req.session.oauthState;

    if (!code || typeof code !== 'string') return fehlerSeite('Es wurde kein Anmeldecode übermittelt.');
    if (!erwartet || !stateGleich(String(state ?? ''), erwartet)) {
      return fehlerSeite(
        'Die Sicherheitsprüfung der Anmeldung ist fehlgeschlagen. ' +
          'Bitte starte die Anmeldung erneut über die Anmeldeseite.',
      );
    }

    let nutzer;
    try {
      const token = await exchangeCode({
        clientId: config.DISCORD_CLIENT_ID,
        clientSecret: config.DISCORD_CLIENT_SECRET,
        redirectUri: config.OAUTH_REDIRECT_URI,
        code,
      });
      nutzer = await fetchDiscordUser(token.access_token);
      // Das Zugriffstoken wird ab hier nicht mehr gebraucht und bewusst
      // weder gespeichert noch protokolliert.
    } catch (err) {
      log.error({ err }, 'OAuth2-Tausch fehlgeschlagen');
      return fehlerSeite('Die Anmeldung bei Discord konnte nicht abgeschlossen werden.');
    }

    const kontext = getKontext();
    leereZugriffsCache(nutzer.id);
    const zugriff = pruefeZugriff(nutzer.id, kontext);

    kontext.repos.log.add(config.GUILD_ID, {
      kind: 'auth',
      status: zugriff.erlaubt ? 'ok' : 'failed',
      actorId: nutzer.id,
      detail: zugriff.erlaubt
        ? `Anmeldung erfolgreich (${zugriff.rolle})`
        : `Anmeldung abgelehnt: ${zugriff.grund}`,
      payloadExcerpt: nutzer.username,
    });

    if (!zugriff.erlaubt) {
      return res.status(403).render('error', {
        titel: 'Kein Zugriff',
        nachricht: zugriff.grund,
        zeigeAbmelden: false,
      });
    }

    const ziel = req.session.returnTo ?? '/';
    // Sitzung neu erzeugen: verhindert, dass eine vor der Anmeldung
    // untergeschobene Sitzungs-ID danach weitergilt.
    req.session.regenerate((err) => {
      if (err) {
        log.error({ err }, 'Sitzung konnte nicht neu erzeugt werden');
        return fehlerSeite('Die Sitzung konnte nicht angelegt werden.');
      }
      req.session.user = nutzer;
      return req.session.save(() => res.redirect(ziel));
    });
    return undefined;
  });

  router.post('/logout', (req, res) => {
    const id = req.session.user?.id;
    if (id) leereZugriffsCache(id);
    req.session.destroy(() => {
      res.clearCookie('panel.sid');
      res.redirect('/login');
    });
  });

  return router;
}
