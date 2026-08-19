import express from 'express';

export function dashboardRoutes({ repos, config, getKontext }) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const { guild } = getKontext();
    const seit24h = Date.now() - 24 * 60 * 60 * 1000;

    res.render('dashboard', {
      titel: 'Übersicht',
      kennzahlen: {
        mitglieder: guild?.memberCount ?? 0,
        rollen: guild ? guild.roles.cache.size - 1 : 0,
        regeln: repos.roleRules.all(config.GUILD_ID).filter((r) => r.enabled).length,
        vorlagen: repos.templates.all(config.GUILD_ID).length,
        momentaufnahmen: repos.memberRoles.count(config.GUILD_ID),
      },
      statistik: repos.log.statusSince(config.GUILD_ID, seit24h),
      willkommenAktiv: repos.settings.get('welcome.enabled', false),
      letzte: repos.log.recent(config.GUILD_ID, { limit: 10 }),
      botRolle: guild?.members.me?.roles.highest.name ?? null,
    });
  });

  return router;
}
