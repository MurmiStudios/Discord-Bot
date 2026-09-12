const { PermissionsBitField, ChannelType } = require('discord.js');
const config = require('../config');
const { getGuild } = require('./client');
const repo = require('../db/repo');

// Vier Zugriffsstufen, in Reihenfolge geprueft: Panel-Administrator schlaegt
// alles, danach Server-Administrator (falls eingeschaltet), danach eine der
// erlaubten Rollen. Alles andere -> kein Zugriff.
//
// Ist PANEL_ADMIN_IDS leer gelassen, wird die erste Person mit der
// Discord-Berechtigung "Administrator" auf dem Server, die sich anmeldet,
// automatisch zum Panel-Administrator -- das erspart das Nachschlagen der
// eigenen Discord-ID beim Einrichten. Absichtlich auf Server-Administratoren
// beschraenkt: sonst koennte irgendjemand mit einem Discord-Konto die
// Anmeldeseite vor dem eigentlichen Betreiber aufrufen und sich selbst zum
// Panel-Administrator machen. Sobald einmal jemand so bestaetigt wurde,
// bleibt es dauerhaft dabei (in der Datenbank vermerkt) -- kein Wettlauf bei
// jedem Neustart.
async function resolveAccessLevel(discordUser) {
  if (config.panelAdminIds.includes(discordUser.id)) return 'panel_admin';

  const guild = getGuild();
  if (!guild) return null;

  let member;
  try {
    member = await guild.members.fetch(discordUser.id);
  } catch {
    return null; // hat den Server verlassen oder ist nicht Mitglied
  }

  const isServerAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);

  if (config.panelAdminIds.length === 0 && isServerAdmin) {
    const winnerId = repo.adminBootstrap.getOrGrant(discordUser.id);
    if (winnerId === discordUser.id) return 'panel_admin';
  }

  if (config.panelServerAdminAccess && isServerAdmin) {
    return 'server_admin';
  }

  if (config.panelAllowedRoleIds.some((roleId) => member.roles.cache.has(roleId))) {
    return 'allowed_role';
  }

  return null;
}

function botHighestPosition(guild) {
  const me = guild.members.me;
  if (!me) return -1;
  return me.roles.highest.position;
}

function roleLockReason(guild, role) {
  const me = guild.members.me;
  if (!me) return 'Bot ist nicht auf dem Server';
  if (role.id === guild.id) return null; // @everyone wird separat gefiltert
  if (role.managed) return 'wird von einer Integration verwaltet';
  if (role.position >= botHighestPosition(guild)) return 'steht über der Bot-Rolle';
  return null;
}

function canBotManageRole(guild, role) {
  return roleLockReason(guild, role) === null;
}

function channelSendability(channel) {
  const guild = channel.guild;
  const me = guild.members.me;
  if (!me) return { can: false, reason: 'Bot ist nicht auf dem Server' };
  const perms = channel.permissionsFor(me);
  if (!perms) return { can: false, reason: 'Berechtigungen unbekannt' };
  if (!perms.has(PermissionsBitField.Flags.ViewChannel)) {
    return { can: false, reason: 'Bot sieht diesen Kanal nicht' };
  }
  if (
    [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.AnnouncementThread, ChannelType.PublicThread, ChannelType.PrivateThread].includes(
      channel.type
    ) &&
    !perms.has(PermissionsBitField.Flags.SendMessages)
  ) {
    return { can: false, reason: 'Bot darf hier nicht schreiben' };
  }
  return { can: true, reason: null };
}

function canBotKick(guild, member) {
  const me = guild.members.me;
  if (!me) return { can: false, reason: 'Bot ist nicht auf dem Server' };
  if (!me.permissions.has(PermissionsBitField.Flags.KickMembers)) {
    return { can: false, reason: 'Bot hat die Berechtigung „Mitglieder kicken“ nicht' };
  }
  if (member.roles.highest.position >= botHighestPosition(guild)) {
    return { can: false, reason: 'Mitglied steht über oder gleich der Bot-Rolle' };
  }
  return { can: true, reason: null };
}

function listSendableChannels(guild) {
  const TEXTY = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
  const channels = [...guild.channels.cache.values()].filter((c) => TEXTY.includes(c.type));
  const categories = new Map();
  const uncategorized = [];
  for (const ch of channels) {
    const { can, reason } = channelSendability(ch);
    const entry = { id: ch.id, name: ch.name, announcement: ch.type === ChannelType.GuildAnnouncement, can, reason };
    if (ch.parentId && guild.channels.cache.has(ch.parentId)) {
      const cat = guild.channels.cache.get(ch.parentId);
      if (!categories.has(cat.id)) categories.set(cat.id, { id: cat.id, name: cat.name, channels: [] });
      categories.get(cat.id).channels.push(entry);
    } else {
      uncategorized.push(entry);
    }
  }
  return { categories: [...categories.values()], uncategorized };
}

module.exports = { resolveAccessLevel, canBotManageRole, roleLockReason, channelSendability, canBotKick, botHighestPosition, listSendableChannels };
