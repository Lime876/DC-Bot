// commands/admin/setlog.js — ESM-Version
import { SlashCommandBuilder, PermissionsBitField, ChannelType } from 'discord.js';
import { setLogChannelId } from '../../utils/config.js';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setlog')
    .setDescription('Setzt oder entfernt den Log-Kanal für verschiedene Ereignisse.')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addStringOption((option) =>
      option
        .setName('log_type')
        .setDescription('Der Typ des Log-Ereignisses.')
        .setRequired(true)
        .addChoices(
          { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_CHANNEL_CREATE'), value: 'channel_create' },
          { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_CHANNEL_DELETE'), value: 'channel_delete' },
          { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_CHANNEL_UPDATE'), value: 'channel_update' },
          { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_ERROR'), value: 'error' },
          { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_GUILD_BAN_ADD'), value: 'guild_ban_add' },
          { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_GUILD_BAN_REMOVE'), value: 'guild_ban_remove' },
          { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_MEMBER_JOIN'), value: 'guild_member_add' },
          { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_MEMBER_REMOVE'), value: 'guild_member_remove' },
          { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_MEMBER_UPDATE'), value: 'guild_member_update' },
          { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_INTERACTION_CREATE'), value: 'interaction_create' },
          { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_INVITE_CREATE'), value: 'invite_create' },
          { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_INVITE_DELETE'), value: 'invite_delete' },
          { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_MESSAGE_CREATE'), value: 'message_create' },
          { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_MESSAGE_DELETE'), value: 'message_delete' },
          { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_MESSAGE_REACTION_ADD'), value: 'message_reaction_add' },
          { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_MESSAGE_REACTION_REMOVE'), value: 'message_reaction_remove' },
          { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_ROLE_CREATE'), value: 'role_create' },
          { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_ROLE_DELETE'), value: 'role_delete' },
          { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_ROLE_UPDATE'), value: 'role_update' },
          { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_SPAM_DETECTION'), value: 'spam_detection' },
          { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_TICKET_SYSTEM'), value: 'ticket_system' },
          { name: getTranslatedText('de', 'setlog_command.LOG_TYPE_CHOICE_VOICE_STATE_UPDATE'), value: 'voice_state_update' }
        ),
    )
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Der Kanal, der als Log-Kanal festgelegt werden soll (leer lassen zum Entfernen).')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false),
    ),

  category: 'Admin',

  async execute(interaction) {
    const lang = await getGuildLanguage(interaction.guildId);
    const logType = interaction.options.getString('log_type');
    const channel = interaction.options.getChannel('channel');

    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply({
        content: getTranslatedText(lang, 'permissions.MISSING_PERMISSION_SINGULAR', {
          permission: getTranslatedText(lang, 'permissions.MANAGE_GUILD'),
        }),
        ephemeral: true,
      });
    }

    try {
      if (channel) {
        setLogChannelId(interaction.guild.id, logType, channel.id);
      } else {
        setLogChannelId(interaction.guild.id, logType, null);
      }

      const actionText = channel
        ? getTranslatedText(lang, 'setlog_command.SET_SUCCESS', {
            logType: getTranslatedText(lang, `setlog_command.LOG_TYPE_CHOICE_${logType.toUpperCase()}`),
            channelMention: channel.toString(),
          })
        : getTranslatedText(lang, 'setlog_command.REMOVE_SUCCESS', {
            logType: getTranslatedText(lang, `setlog_command.LOG_TYPE_CHOICE_${logType.toUpperCase()}`),
          });

      await interaction.reply({
        content: `${actionText}\n${getTranslatedText(lang, 'setlog_command.HINT_AFTER_SET')}`,
        ephemeral: true,
      });

      logger.info(
        `[SetLog Command] Log-Kanal für '${logType}' in Gilde ${interaction.guild.id} ${channel ? 'gesetzt auf ' + channel.id : 'entfernt'}.`
      );
    } catch (error) {
      logger.error(`[SetLog Command] Fehler beim Setzen/Entfernen des Log-Kanals für '${logType}':`, error);

      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'), ephemeral: true });
        } else {
          await interaction.followUp({ content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'), ephemeral: true });
        }
      } catch (err) {
        logger.error('[SetLog Command] Konnte Fehlermeldung nicht senden:', err);
      }
    }
  },
};