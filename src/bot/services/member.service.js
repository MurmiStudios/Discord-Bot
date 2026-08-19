/**
 * Mitglieder für die Auswahl im Panel.
 *
 * Greift auf den Cache zu, den ready.js beim Start einmal vollständig befüllt.
 * Das hält die Suche schnell und erzeugt keine API-Last beim Tippen.
 */
export function sucheMitglieder(guild, suchbegriff = '', limit = 50) {
  const q = suchbegriff.trim().toLowerCase();
  const treffer = [];

  for (const m of guild.members.cache.values()) {
    if (m.user.bot) continue;
    if (q) {
      const passt =
        m.displayName.toLowerCase().includes(q) ||
        m.user.username.toLowerCase().includes(q) ||
        m.id === q;
      if (!passt) continue;
    }
    treffer.push(zuEintrag(m));
    if (treffer.length >= limit) break;
  }

  return treffer.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function zuEintrag(member) {
  return {
    id: member.id,
    displayName: member.displayName,
    username: member.user.username,
    avatarUrl: avatarUrl(member),
    roleIds: [...member.roles.cache.keys()].filter((r) => r !== member.guild.id),
  };
}

/**
 * Avatar-URL für den Renderer.
 *
 * forceStatic ist wichtig: animierte Avatare liefern sonst ein GIF, von dem
 * nur der erste Frame gebraucht wird — unnötig gross und langsam.
 */
export function avatarUrl(userOrMember) {
  return userOrMember.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
}

export function mitgliedAusCache(guild, userId) {
  const m = guild.members.cache.get(userId);
  return m ? zuEintrag(m) : null;
}

/** Alle Mitglieder mit einer bestimmten Rolle — für den gezielten Massenversand. */
export function mitgliederMitRolle(guild, roleId) {
  return [...guild.members.cache.values()]
    .filter((m) => !m.user.bot && m.roles.cache.has(roleId))
    .map(zuEintrag);
}
