// Erfundene Beispieldaten fuer die Vorschau, wenn (noch) kein echtes
// Mitglied gewaehlt ist oder der Bot nicht verbunden ist.
function sampleContext(overrides = {}) {
  return {
    userName: 'Lena K.',
    userTag: 'lena.k',
    guildName: 'Murmi Community',
    memberCount: 1284,
    roleName: 'Verifiziert',
    avatarUrl: null,
    clickerName: 'Nico',
    clickerTag: 'nico',
    feedback: 'Beispiel-Antwort',
    ...overrides,
  };
}

const RAW_CONTEXT = {
  userName: '{user}',
  userTag: '{tag}',
  guildName: '{guild}',
  memberCount: '{count}',
  roleName: '{role}',
  avatarUrl: null,
};

module.exports = { sampleContext, RAW_CONTEXT };
