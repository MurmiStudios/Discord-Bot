const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const SqliteSessionStore = require('./sqliteSessionStore');

const config = require('../config');
const { isReady } = require('../discord/client');
const { buildNav } = require('./navData');
const icons = require('./icons');
const { attachToken, verifyToken } = require('./middleware/csrf');
const { requireLogin, refreshAccess, requireAccess, accessLabel } = require('./middleware/auth');
const rateLimit = require('./middleware/rateLimit');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const messageRoutes = require('./routes/message');
const savedMessagesRoutes = require('./routes/savedMessages');
const welcomeRoutes = require('./routes/welcome');
const roleMessagesRoutes = require('./routes/roleMessages');
const roleRulesRoutes = require('./routes/roleRules');
const actionBarsRoutes = require('./routes/actionBars');
const imageTemplatesRoutes = require('./routes/imageTemplates');
const feedbackRoutes = require('./routes/feedback');
const logRoutes = require('./routes/log');
const apiRoutes = require('./routes/api');

function createApp() {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          fontSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https://cdn.discordapp.com'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use('/public', express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
  app.use('/uploads', express.static(path.join(config.dataDir, 'uploads'), { maxAge: '1d' }));

  app.use(express.urlencoded({ extended: true, limit: '200kb' }));
  app.use(express.json({ limit: '200kb' }));

  app.use(
    session({
      store: new SqliteSessionStore(),
      name: 'panel.sid',
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.trustProxy,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    })
  );

  app.use(attachToken);
  app.use(rateLimit.general);

  app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.accessLabel = req.session.user ? accessLabel(req.session.user.accessLevel) : null;
    res.locals.currentPath = req.path;
    res.locals.baseUrl = config.baseUrl;
    res.locals.botOnline = isReady();
    res.locals.icons = icons;
    next();
  });

  app.use(authRoutes);

  // Ab hier: nur fuer angemeldete Personen mit einer der vier Zugriffsstufen.
  app.use(requireLogin, refreshAccess, requireAccess, verifyToken);

  app.use((req, res, next) => {
    res.locals.nav = buildNav();
    res.locals.flash = req.session.flash || null;
    delete req.session.flash;
    next();
  });

  app.use('/', dashboardRoutes);
  app.use('/', messageRoutes);
  app.use('/', savedMessagesRoutes);
  app.use('/', welcomeRoutes);
  app.use('/', roleMessagesRoutes);
  app.use('/', roleRulesRoutes);
  app.use('/', actionBarsRoutes);
  app.use('/', imageTemplatesRoutes);
  app.use('/', feedbackRoutes);
  app.use('/', logRoutes);
  app.use('/api', apiRoutes);

  app.use((req, res) => {
    res.status(404).render('errors/404', { title: 'Nicht gefunden' });
  });

  app.use((err, req, res, next) => {
    console.error('[web]', err);
    res.status(500).render('errors/403', { title: 'Fehler', reason: 'Etwas ist schiefgelaufen. Bitte erneut versuchen.' });
  });

  return app;
}

module.exports = createApp;
