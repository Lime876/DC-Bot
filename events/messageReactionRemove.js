const { Events } = require('discord.js');

module.exports = {
  name: Events.MessageReactionRemove,
  async execute(reaction, user, client) {
    if (user.bot) return;

    // Falls die Reaction partiell ist, versuche sie abzurufen
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        console.error('Fehler beim Abrufen einer partiellen Reaction:', error);
        return;
      }
    }

    const roleAssignments = client.reactionRoleMappings.get(reaction.message.id);
    if (!roleAssignments) return;

    // Nutze entweder die Emoji-ID oder den Namen, damit sowohl Custom- als auch Standardemojis unterstützt werden
    const emojiKey = reaction.emoji.id || reaction.emoji.name;
    const roleId = roleAssignments[emojiKey];
    if (!roleId) return;

    try {
      const guild = reaction.message.guild;
      const member = await guild.members.fetch(user.id);
      await member.roles.remove(roleId);
      console.log(`❌ Rolle ${roleId} wurde von ${user.tag} entfernt.`);
    } catch (error) {
      console.error(`Fehler beim Entfernen der Rolle:`, error);
    }
  },
};