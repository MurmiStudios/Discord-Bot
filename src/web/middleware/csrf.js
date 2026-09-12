const crypto = require('crypto');

// Eigenes, schlankes CSRF-Token statt einer externen Bibliothek: ein
// zufaelliger Token pro Sitzung, als verstecktes Feld in jedem Formular UND
// als Header bei Fetch-Aufrufen. Eine fremde Seite kennt die Sitzung nicht
// und kann den Token daher nicht mitschicken.
function attachToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

function verifyToken(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const sent = req.body?._csrf || req.get('x-csrf-token');
  if (!sent || sent !== req.session.csrfToken) {
    return res.status(403).render('errors/403', { title: 'Zugriff verweigert', reason: 'Ungültiges oder abgelaufenes Formular. Bitte Seite neu laden und erneut versuchen.' });
  }
  next();
}

module.exports = { attachToken, verifyToken };
