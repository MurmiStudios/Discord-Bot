const { resolveAccessLevel } = require('../../discord/permissions');

const RECHECK_MS = 5 * 60 * 1000;

const ACCESS_LABEL = {
  panel_admin: 'Panel-Administrator',
  server_admin: 'Server-Administrator',
  allowed_role: 'berechtigte Rolle',
};

function requireLogin(req, res, next) {
  if (!req.session.user) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }
  next();
}

// Prueft in regelmaessigen Abstaenden erneut, ob die Person noch Mitglied ist
// und noch Zugriff hat -- ohne bei jeder Anfrage Discord zu fragen.
async function refreshAccess(req, res, next) {
  const user = req.session.user;
  if (!user) return next();

  const stale = !user.accessCheckedAt || Date.now() - user.accessCheckedAt > RECHECK_MS;
  if (stale) {
    const level = await resolveAccessLevel({ id: user.id });
    user.accessLevel = level;
    user.accessCheckedAt = Date.now();
  }
  next();
}

function requireAccess(req, res, next) {
  const user = req.session.user;
  if (!user || !user.accessLevel) {
    return res.status(403).render('errors/403', {
      title: 'Kein Zugriff',
      reason:
        'Du bist als ' +
        (user ? user.username : 'unbekannt') +
        ' angemeldet, aber weder Panel-Administrator noch Server-Administrator noch Mitglied einer berechtigten Rolle auf diesem Server.',
    });
  }
  next();
}

function accessLabel(level) {
  return ACCESS_LABEL[level] || null;
}

module.exports = { requireLogin, refreshAccess, requireAccess, accessLabel };
