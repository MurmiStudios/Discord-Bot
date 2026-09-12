const repo = require('../db/repo');
const icons = require('./icons');

// Baut die gruppierte Navigation mit aktuellen Zaehlern -- dieselbe Struktur
// wie im Panel-Mockup: SENDEN / AUTOMATISCH / BAUSTEINE / VERLAUF.
function buildNav() {
  const savedCount = repo.messages.list().length;
  const feedbackTotal = repo.feedback.list().length;

  return [
    {
      label: 'Senden',
      items: [
        { href: '/nachricht', label: 'Nachricht', icon: icons.message, badge: 'neu' },
        { href: '/nachrichten', label: 'Gespeicherte Nachrichten', icon: icons.folder, count: savedCount },
      ],
    },
    {
      label: 'Automatisch',
      items: [
        { href: '/willkommen', label: 'Willkommen', icon: icons.userPlus },
        { href: '/rollen-nachrichten', label: 'Rollen-Nachrichten', icon: icons.message },
        { href: '/rollenregeln', label: 'Rollenregeln', icon: icons.clipboard },
      ],
    },
    {
      label: 'Bausteine',
      items: [
        { href: '/aktionsleisten', label: 'Aktionsleisten', icon: icons.link },
        { href: '/vorlagen', label: 'Bildvorlagen', icon: icons.image },
      ],
    },
    {
      label: 'Verlauf',
      items: [
        { href: '/', label: 'Übersicht', icon: icons.home },
        { href: '/rueckmeldungen', label: 'Rückmeldungen', icon: icons.fileText, count: feedbackTotal || null },
        { href: '/protokoll', label: 'Protokoll', icon: icons.clipboard },
      ],
    },
  ];
}

module.exports = { buildNav };
