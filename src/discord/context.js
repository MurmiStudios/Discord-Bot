// Baut den Platzhalter-/Bildkontext fuer eine Person, einheitlich fuer
// Willkommen, Rollen-Nachrichten, Massenversand und Button-Aktionen.
function ctxForMember(member, guild, extra = {}) {
  return {
    userName: member.displayName || member.user.username,
    userTag: member.user.tag,
    guildName: guild.name,
    memberCount: guild.memberCount,
    avatarUrl: member.displayAvatarURL({ extension: 'png', size: 256 }),
    roleName: extra.roleName || '',
    clickerName: extra.clickerName || '',
    clickerTag: extra.clickerTag || '',
    feedback: extra.feedback || '',
  };
}

function ctxForUser(user, guild, extra = {}) {
  return {
    userName: user.username,
    userTag: user.tag,
    guildName: guild ? guild.name : '',
    memberCount: guild ? guild.memberCount : 0,
    avatarUrl: user.displayAvatarURL({ extension: 'png', size: 256 }),
    roleName: extra.roleName || '',
    clickerName: extra.clickerName || '',
    clickerTag: extra.clickerTag || '',
    feedback: extra.feedback || '',
  };
}

module.exports = { ctxForMember, ctxForUser };
