// commands/kick.js
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags
} from 'discord.js';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';
import { getLogChannelId } from '../../utils/config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kickt einen Benutzer vom Server')
    .setDescriptionLocalizations({
      de: getTranslatedText('de', 'kick_command.DESCRIPTION'),
      'en-US': getTranslatedText('en', 'kick_command.DESCRIPTION'),
    })
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Der zu kickende User')
        .setDescriptionLocalizations({
          de: getTranslatedText('de', 'kick_command.USER_OPTION_DESCRIPTION'),
          'en-US': getTranslatedText('en', 'kick_command.USER_OPTION_DESCRIPTION'),
        })
        .setRequired(true))
    .addStringOption(option =>
      option.setName('grund')
        .setDescription('Grund für den Kick')
        .setDescriptionLocalizations({
          de: getTranslatedText('de', 'kick_command.REASON_OPTION_DESCRIPTION'),
          'en-US': getTranslatedText('en', 'kick_command.REASON_OPTION_DESCRIPTION'),
        })
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  category: 'Moderation',

  async execute(interaction) {
    const lang = await getGuildLanguage(interaction.guildId);

    // Defer reply immediately
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('grund') || getTranslatedText(lang, 'kick_command.NO_REASON_PROVIDED');
    const targetMember = interaction.guild.members.cache.get(targetUser.id);

    // Überprüfe, ob der Bot die Berechtigung hat, Mitglieder zu kicken
    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.KickMembers)) {
      logger.warn(
        `[Kick Command] Bot hat nicht die Berechtigung 'KickMembers' in Gilde ${interaction.guild.id}. (PID: ${process.pid})`
      );
      return interaction.editReply({
        content: getTranslatedText(lang, 'kick_command.NO_PERMISSION_BOT'),
      });
    }

    // Überprüfe, ob der Benutzer sich selbst kicken will
    if (targetUser.id === interaction.user.id) {
      return interaction.editReply({
        content: getTranslatedText(lang, 'kick_command.CANNOT_KICK_SELF'),
      });
    }

    // Überprüfe, ob der Benutzer einen anderen Bot kicken will
    if (targetUser.bot) {
      return interaction.editReply({
        content: getTranslatedText(lang, 'kick_command.CANNOT_KICK_BOT'),
      });
    }

    try {
      if (!targetMember) {
        return interaction.editReply({ content: getTranslatedText(lang, 'kick_command.USER_NOT_ON_SERVER') });
      }

      // Überprüfe die Rollenhierarchie
      if (!targetMember.kickable) {
        logger.warn(
          `[Kick Command] Bot kann Benutzer ${targetUser.tag} nicht kicken, da Rollenhierarchie zu niedrig in Gilde ${interaction.guild.id}. (PID: ${process.pid})`
        );
        return interaction.editReply({ content: getTranslatedText(lang, 'kick_command.CANNOT_KICK_HIGHER') });
      }

      await targetMember.kick(reason);

      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle(getTranslatedText(lang, 'kick_command.EMBED_TITLE'))
        .addFields(
          { name: getTranslatedText(lang, 'kick_command.FIELD_USER'), value: `${targetUser.tag}`, inline: true },
          { name: getTranslatedText(lang, 'kick_command.FIELD_KICKED_BY'), value: `${interaction.user.tag}`, inline: true },
          { name: getTranslatedText(lang, 'kick_command.FIELD_REASON'), value: reason }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Optional: Log in einen Logchannel senden
      const logChannelId = getLogChannelId(interaction.guild.id);
      if (logChannelId) {
        const logChannel = interaction.guild.channels.cache.get(logChannelId);
        if (logChannel) {
          await logChannel.send({ embeds: [embed] }).catch(error => {
            logger.error('[Kick Command] Failed to send log message: ', error);
          });
        }
      }
    } catch (error) {
      logger.error(
        `[Kick] Fehler beim Kicken des Benutzers ${targetUser.tag} in Gilde ${interaction.guild.id}:`,
        error
      );
      await interaction.editReply({
        content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED_UNEXPECTED', { errorMessage: error.message }),
      });
    }
  }
};