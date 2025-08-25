import { Events, EmbedBuilder } from 'discord.js';
import { getLogChannelId } from '../utils/config.js';
import { getGuildLanguage, getTranslatedText } from '../utils/languageUtils.js';
import logger from '../utils/logger.js';

export default {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage) {
        if (!oldMessage.guild || oldMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return;

        const guild = newMessage.guild;
        const lang = await getGuildLanguage(guild.id);

        const logChannelId = getLogChannelId(guild.id, 'message_edit');
        if (!logChannelId) return;

        const logChannel = guild.channels.cache.get(logChannelId);
        if (!logChannel?.isTextBased()) {
            logger.warn(`[Message Update] Ungültiger Log-Kanal (${logChannelId}) in Gilde ${guild.id}. (PID: ${process.pid})`);
            return;
        }

        const authorTag = oldMessage.author.tag;
        const authorId = oldMessage.author.id;
        const channelMention = oldMessage.channel.toString();

        const oldContent = oldMessage.content || getTranslatedText(lang, 'message_edit.NO_CONTENT');
        const newContent = newMessage.content || getTranslatedText(lang, 'message_edit.NO_CONTENT');

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(getTranslatedText(lang, 'message_edit.LOG_TITLE'))
            .setDescription(getTranslatedText(lang, 'message_edit.LOG_DESCRIPTION', { authorTag, authorId, channelMention }))
            .addFields(
                {
                    name: getTranslatedText(lang, 'message_edit.FIELD_OLD_CONTENT'),
                    value: oldContent.length > 1024 ? oldContent.slice(0, 1021) + '...' : oldContent,
                    inline: false
                },
                {
                    name: getTranslatedText(lang, 'message_edit.FIELD_NEW_CONTENT'),
                    value: newContent.length > 1024 ? newContent.slice(0, 1021) + '...' : newContent,
                    inline: false
                }
            )
            .setTimestamp()
            .setFooter({
                text: getTranslatedText(lang, 'message_edit.FOOTER_MESSAGE_ID', { messageId: oldMessage.id })
            });

        try {
            await logChannel.send({ embeds: [embed] });
            logger.info(`[Message Update] Nachricht von ${authorTag} in ${channelMention} bearbeitet. (PID: ${process.pid})`);
        } catch (error) {
            logger.error(`[Message Update] Fehler beim Senden des Logs für ${authorTag} in ${guild.id}:`, error);
        }
    },
};
