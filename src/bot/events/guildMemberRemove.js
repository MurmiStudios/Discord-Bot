/** Mitglied hat den Server verlassen: Momentaufnahme aufräumen. */
export function registriereGuildMemberRemove(client, { repos, config, log }) {
  client.on('guildMemberRemove', (member) => {
    if (member.guild?.id !== config.GUILD_ID) return;
    try {
      repos.memberRoles.delete(member.guild.id, member.id);
    } catch (err) {
      log.error({ err, userId: member.id }, 'Momentaufnahme konnte nicht gelöscht werden');
    }
  });
}
