const { client, start } = require('./client');

require('./events/guildMemberAdd')(client);
require('./events/guildMemberUpdate')(client);
require('./events/interactionCreate')(client);

module.exports = { client, start };
