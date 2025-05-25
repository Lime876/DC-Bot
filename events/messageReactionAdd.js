module.exports = {
  name: 'messageReactionAdd',
  async execute(reaction, user, client) {
    // Ignoriere Reaktionen von Bots
    if (user.bot) return;

    // Sicherstellen, dass die vollständige Nachricht vorliegt
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        console.error('Fehler beim Abrufen der partielle Nachricht:', error);
        return;
      }
    }

    // Überprüfe, ob die Nachricht für Reaktionsrollen registriert ist
    const mapping = client.reactionRoleMappings.get(reaction.message.id);
    if (!mapping) return;

    // Falls mehrere Reaktionen oder Argumente nötig sein sollten, erweitere diesen Block
    const roleId = mapping[reaction.emoji.name];
    if (!roleId) return;

    const guild = reaction.message.guild;
    if (!guild) return;

    const member = await guild.members.fetch(user.id);
    if (!member) return;

    try {
      await member.roles.add(roleId);
      console.log(`Rolle ${roleId} wurde ${user.tag} hinzugefügt.`);
    } catch (error) {
      console.error(`Fehler beim Hinzufügen der Rolle: ${error}`);
    }
  }
};