const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('../config');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.GuildMember, Partials.User],
});

let ready = false;
client.once('ready', () => {
  ready = true;
  console.log(`[bot] angemeldet als ${client.user.tag}`);
});

client.on('error', (err) => console.error('[bot] Fehler:', err));
client.on('shardDisconnect', () => {
  ready = false;
});
client.on('shardReconnecting', () => {
  ready = false;
});
client.on('shardResume', () => {
  ready = true;
});

function isReady() {
  return ready && client.isReady();
}

function getGuild() {
  if (!isReady()) return null;
  return client.guilds.cache.get(config.discord.guildId) || null;
}

async function start() {
  await client.login(config.discord.botToken);
}

module.exports = { client, isReady, getGuild, start };
