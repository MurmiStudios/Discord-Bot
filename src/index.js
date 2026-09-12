const config = require('./config');
require('./db'); // legt/aktualisiert die SQLite-Datei an
const bot = require('./discord');
const createApp = require('./web/app');

async function main() {
  const app = createApp();
  app.listen(config.port, config.host, () => {
    console.log(`[web] Panel läuft auf ${config.baseUrl} (lauscht auf ${config.host}:${config.port})`);
  });

  try {
    await bot.start();
  } catch (err) {
    console.error('[bot] Konnte sich nicht anmelden -- Panel läuft weiter, aber ohne Bot-Funktionen:', err.message);
  }
}

main();
