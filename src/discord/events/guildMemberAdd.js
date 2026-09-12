const repo = require('../../db/repo');
const { buildMessagePayload } = require('../renderer');
const { ctxForMember } = require('../context');
const { sendDm, describeError } = require('../send');

module.exports = function register(client) {
  client.on('guildMemberAdd', async (member) => {
    const welcome = repo.welcome.get();
    if (!welcome.active) return;
    if (!welcome.content && !welcome.embed && !welcome.image_template_id) return;

    const ctx = ctxForMember(member, member.guild);
    try {
      const payload = await buildMessagePayload(
        {
          content: welcome.content,
          embed: welcome.embed,
          imageTemplate: repo.imageTemplates.get(welcome.image_template_id),
          actionBar: repo.actionBars.get(welcome.action_bar_id),
        },
        ctx
      );
      await sendDm(member.user, payload);
      repo.audit.log({ kind: 'nachricht', summary: `Willkommen-DM an ${member.user.tag}`, success: true });
    } catch (err) {
      repo.audit.log({
        kind: 'nachricht',
        summary: `Willkommen-DM an ${member.user.tag} nicht zugestellt`,
        success: false,
        reason: describeError(err),
      });
    }
  });
};
