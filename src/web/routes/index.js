/** Bündelt alle Panel-Routen. */
import express from 'express';
import { dashboardRoutes } from './dashboard.routes.js';
import { dmRoutes } from './dm.routes.js';
import { channelRoutes } from './channels.routes.js';
import { roleMessagesRoutes } from './roleMessages.routes.js';
import { roleRulesRoutes } from './roleRules.routes.js';
import { templateRoutes } from './templates.routes.js';
import { welcomeRoutes } from './welcome.routes.js';
import { logsRoutes } from './logs.routes.js';

export function panelRoutes(kontext) {
  const router = express.Router();
  router.use(dashboardRoutes(kontext));
  router.use(dmRoutes(kontext));
  router.use(channelRoutes(kontext));
  router.use(roleMessagesRoutes(kontext));
  router.use(roleRulesRoutes(kontext));
  router.use(templateRoutes(kontext));
  router.use(welcomeRoutes(kontext));
  router.use(logsRoutes(kontext));
  return router;
}
