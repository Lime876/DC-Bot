// events/messageReactionAdd.js
const { Events, EmbedBuilder, Partials } = require('discord.js');
const { getLogChannelId } = require('../utils/config.js');
const { getGuildLanguage, getTranslatedText } = require('../utils/languageUtils');
const logger = require('../utils/logger');

module.exports = {
    name: Events.MessageReactionAdd,
    // Füge Partials hinzu, damit der Client auch auf Reaktionen auf nicht gecachte Nachrichten reagiert
    // Dies sollte in der Client-Initialisierung in index.js konfiguriert werden:
    // partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
    async execute(reaction, user) {
        // Wenn die Reaktion oder der Benutzer ein Partial ist, hole die vollständigen Daten
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                logger.error(`[MessageReactionAdd Event] Fehler beim Fetchen der Partial-Reaktion:`, error);
                return;
            }
        }
        if (user.partial) {
            try {
                await user.fetch();
            } catch (error) {
                logger.error(`[MessageReactionAdd Event] Fehler beim Fetchen des Partial-Benutzers:`, error);
                return;
            }
        }

        // Ignoriere Reaktionen von Bots
        if (user.bot) return;

        const message = reaction.message;
        // Ignoriere Reaktionen in DMs (keine Gilde)
        if (!message.guild) return;

        const guild = message.guild;
        const lang = await getGuildLanguage(guild.id);
        const logChannelId = getLogChannelId(guild.id, 'message_reaction_add');

        if (!logChannelId) {
            // logger.debug(`[MessageReactionAdd Event] Kein Log-Kanal für 'message_reaction_add' in Gilde ${guild.id} konfiguriert. (PID: ${process.pid})`);
            return;
        }

        const logChannel = guild.channels.cache.get(logChannelId);
        if (!logChannel || !logChannel.isTextBased()) {
            logger.warn(`[MessageReactionAdd Event] Konfigurierter Log-Kanal ${logChannelId} für Gilde ${guild.id} ist ungültig oder kein Textkanal. (PID: ${process.pid})`);
            return;
        }

        const emojiIdentifier = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;
        const messageContent = message.content ? message.content.substring(0, 500) + (message.content.length > 500 ? '...' : '') : getTranslatedText(lang, 'message_reaction_add.NO_CONTENT');
        const messageLink = `https://discord.com/channels/${guild.id}/${message.channel.id}/${message.id}`;

        const embed = new EmbedBuilder()
            .setColor(0x00FF00) // Grün für hinzugefügte Reaktionen
            .setTitle(getTranslatedText(lang, 'message_reaction_add.LOG_TITLE'))
            .setDescription(getTranslatedText(lang, 'message_reaction_add.LOG_DESCRIPTION'))
            .addFields(
                { name: getTranslatedText(lang, 'message_reaction_add.FIELD_USER'), value: `${user.tag} (<@${user.id}>)`, inline: true },
                { name: getTranslatedText(lang, 'message_reaction_add.FIELD_EMOJI'), value: emojiIdentifier, inline: true },
                { name: getTranslatedText(lang, 'message_reaction_add.FIELD_CHANNEL'), value: message.channel.toString(), inline: true },
                { name: getTranslatedText(lang, 'message_reaction_add.FIELD_MESSAGE_ID'), value: `[${message.id}](${messageLink})`, inline: false },
                { name: getTranslatedText(lang, 'message_reaction_add.FIELD_MESSAGE_CONTENT'), value: messageContent, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `Benutzer ID: ${user.id} | Nachricht ID: ${message.id}` });

        try {
            await logChannel.send({ embeds: [embed] });
            logger.info(`[MessageReactionAdd Event] Reaktion ${emojiIdentifier} von ${user.tag} zu Nachricht ${message.id} in Gilde ${guild.name} hinzugefügt. (PID: ${process.pid})`);
        } catch (error) {
            logger.error(`[MessageReactionAdd Event] Fehler beim Senden des Reaktions-Add-Logs für ${user.tag}:`, error);
        }
    },
};