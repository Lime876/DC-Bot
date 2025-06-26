// events/messageReactionAdd.js
const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageReactionAdd,
    async execute(reaction, user, client) { // 'client' als drittes Argument hinzugefügt
        // Ignoriere Reaktionen von Bots
        if (user.bot) return;

        // Wenn die Nachricht oder Reaktion ein Partial ist, hole die vollständigen Daten
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('Fehler beim Fetchen der Partial-Reaction:', error);
                return;
            }
        }
        if (reaction.message.partial) {
            try {
                await reaction.message.fetch();
            } catch (error) {
                console.error('Fehler beim Fetchen der Partial-Nachricht:', error);
                return;
            }
        }

        // Wenn der Benutzer ein Partial ist, hole die vollständigen Daten (optional, aber gut für Robustheit)
        if (user.partial) {
            try {
                await user.fetch();
            } catch (error) {
                console.error('Fehler beim Fetchen des Partial-Users:', error);
                return;
            }
        }

        // Jetzt können wir sicher auf reaction.message und user zugreifen
        const message = reaction.message;
        const emoji = reaction.emoji.name;
        const guild = message.guild;

        // Beispiel: Hier könntest du auf bestimmte Reaktionen reagieren
        // if (message.id === 'DEINE_NACHRICHTEN_ID' && emoji === '✅') {
        //     const member = guild.members.cache.get(user.id);
        //     if (member) {
        //         // Tu etwas, z.B. eine Rolle geben
        //         // await member.roles.add('ROLLEN_ID');
        //         console.log(`${user.tag} hat auf die Nachricht reagiert.`);
        //     }
        // }
    },
};