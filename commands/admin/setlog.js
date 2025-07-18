// commands/utility/setlog.js
const { SlashCommandBuilder, PermissionsBitField, ChannelType, MessageFlags } = require('discord.js');
const { setLogChannelId } = require('../../utils/config.js');
const { getGuildLanguage, getTranslatedText } = require('../../utils/languageUtils');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setlog')
        .setDescription('Setzt oder entfernt den Log-Kanal für verschiedene Ereignisse.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
        .addStringOption(option =>
            option.setName('log_type')
                .setDescription('Der Typ des Log-Ereignisses (z.B. message_delete, member_join).')
                .setRequired(true)
                .addChoices(
                    { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_MESSAGE_DELETE'), value: 'message_delete' },
                    { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_MESSAGE_EDIT'), value: 'message_edit' },
                    { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_MEMBER_JOIN'), value: 'member_join' },
                    { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_MEMBER_LEAVE'), value: 'member_leave' },
                    { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_MEMBER_BAN'), value: 'member_ban' },
                    { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_MEMBER_UNBAN'), value: 'member_unban' },
                    { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_CHANNEL_CREATE'), value: 'channel_create' },
                    { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_CHANNEL_DELETE'), value: 'channel_delete' },
                    { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_CHANNEL_UPDATE'), value: 'channel_update' },
                    { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_ROLE_CREATE'), value: 'role_create' },
                    { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_ROLE_DELETE'), value: 'role_delete' },
                    { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_ROLE_UPDATE'), value: 'role_update' },
                    { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_GUILD_UPDATE'), value: 'guild_update' },
                    { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_VOICE_JOIN'), value: 'voice_join' },
                    { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_VOICE_LEAVE'), value: 'voice_leave' },
                    { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_VOICE_MOVE'), value: 'voice_move' },
                    { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_VOICE_STREAM_START'), value: 'voice_stream_start' },
                    { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_VOICE_STREAM_STOP'), value: 'voice_stream_stop' },
                    { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_VOICE_VIDEO_START'), value: 'voice_video_start' },
                    { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_VOICE_VIDEO_STOP'), value: 'voice_video_stop' },
                    { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_MEMBER_UPDATE'), value: 'member_update' },
                    { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_MESSAGE_REACTION_ADD'), value: 'message_reaction_add' },
                    { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_MESSAGE_REACTION_REMOVE'), value: 'message_reaction_remove' }
                ))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Der Kanal, der als Log-Kanal festgelegt werden soll (leer lassen zum Entfernen).')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)),

    async execute(interaction) {
        const lang = await getGuildLanguage(interaction.guildId);
        const logType = interaction.options.getString('log_type');
        const channel = interaction.options.getChannel('channel');

        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.reply({
                content: getTranslatedText(lang, 'permissions.MISSING_PERMISSION_SINGULAR', { permission: getTranslatedText(lang, 'permissions.MANAGE_GUILD') }),
                flags: [MessageFlags.Ephemeral]
            });
        }

        try {
            if (channel) {
                setLogChannelId(interaction.guild.id, logType, channel.id);
                await interaction.reply({
                    content: getTranslatedText(lang, 'setlog_command.SET_SUCCESS', { logType: getTranslatedText(lang, `setlog_command.LOG_TYPE_CHOICE_${logType.toUpperCase()}`), channelMention: channel.toString() }),
                    flags: [MessageFlags.Ephemeral]
                });
                logger.info(`[SetLog Command] Log-Kanal für '${logType}' in Gilde ${interaction.guild.id} auf ${channel.id} gesetzt. (PID: ${process.pid})`);
            } else {
                setLogChannelId(interaction.guild.id, logType, null);
                await interaction.reply({
                    content: getTranslatedText(lang, 'setlog_command.REMOVE_SUCCESS', { logType: getTranslatedText(lang, `setlog_command.LOG_TYPE_CHOICE_${logType.toUpperCase()}`) }),
                    flags: [MessageFlags.Ephemeral]
                });
                logger.info(`[SetLog Command] Log-Kanal für '${logType}' in Gilde ${interaction.guild.id} entfernt. (PID: ${process.pid})`);
            }
        } catch (error) {
            logger.error(`[SetLog Command] Fehler beim Setzen/Entfernen des Log-Kanals für '${logType}' in Gilde ${interaction.guild.id}:`, error);
            await interaction.reply({
                content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'),
                flags: [MessageFlags.Ephemeral]
            });
        }
    },
};
