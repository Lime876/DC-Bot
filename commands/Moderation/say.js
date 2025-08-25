// commands/moderation/say.js
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  MessageFlags
} from 'discord.js';
import { getLogChannelId } from '../../utils/config.js';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Lässt den Bot eine Nachricht in einem Kanal senden.')
    .setDescriptionLocalizations({
      de: getTranslatedText('de', 'say_command.DESCRIPTION'),
      'en-US': getTranslatedText('en', 'say_command.DESCRIPTION'),
    })
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Die Nachricht, die gesendet werden soll.')
        .setDescriptionLocalizations({
          de: getTranslatedText('de', 'say_command.MESSAGE_OPTION_DESCRIPTION'),
          'en-US': getTranslatedText('en', 'say_command.MESSAGE_OPTION_DESCRIPTION'),
        })
        .setRequired(true))
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Der Kanal, in dem die Nachricht gesendet werden soll (Standard: aktueller Kanal).')
        .setDescriptionLocalizations({
          de: getTranslatedText('de', 'say_command.CHANNEL_OPTION_DESCRIPTION'),
          'en-US': getTranslatedText('en', 'say_command.CHANNEL_OPTION_DESCRIPTION'),
        })
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  category: 'Moderation',

  async execute(interaction) {
    const lang = await getGuildLanguage(interaction.guildId);
    const messageContent = interaction.options.getString('message');
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const guildId = interaction.guild.id;

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    // Überprüfen, ob es ein Text- oder Ankündigungskanal ist
    if (targetChannel.type !== ChannelType.GuildText && targetChannel.type !== ChannelType.GuildAnnouncement) {
      return interaction.editReply({ content: getTranslatedText(lang, 'say_command.INVALID_CHANNEL_TYPE') });
    }

    // Berechtigungen prüfen
    const botPermissionsInChannel = targetChannel.permissionsFor(interaction.client.user);
    if (!botPermissionsInChannel?.has(PermissionFlagsBits.SendMessages)) {
      return interaction.editReply({
        content: getTranslatedText(lang, 'say_command.BOT_MISSING_SEND_PERMISSIONS', { channelMention: targetChannel.toString() })
      });
    }

    try {
      await targetChannel.send(messageContent);

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle(getTranslatedText(lang, 'say_command.SUCCESS_EMBED_TITLE'))
        .setDescription(getTranslatedText(lang, 'say_command.SUCCESS_EMBED_DESCRIPTION', { channelMention: targetChannel.toString() }))
        .addFields(
          { name: getTranslatedText(lang, 'say_command.FIELD_CHANNEL'), value: `<#${targetChannel.id}>`, inline: true },
          { name: getTranslatedText(lang, 'say_command.FIELD_MESSAGE_PREVIEW'), value: `\`\`\`\n${messageContent.substring(0, 1000)}\n\`\`\``, inline: false }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Optional: Log-Kanal
      const logChannelId = getLogChannelId(guildId);
      if (logChannelId) {
        const logChannel = interaction.guild.channels.cache.get(logChannelId);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(getTranslatedText(lang, 'say_command.LOG_EMBED_TITLE'))
            .setDescription(getTranslatedText(lang, 'say_command.LOG_EMBED_DESCRIPTION', { userTag: interaction.user.tag }))
            .addFields(
              { name: getTranslatedText(lang, 'say_command.LOG_FIELD_CHANNEL'), value: `<#${targetChannel.id}>`, inline: true },
              { name: getTranslatedText(lang, 'say_command.LOG_FIELD_SENT_BY'), value: `<@${interaction.user.id}>`, inline: true },
              { name: getTranslatedText(lang, 'say_command.LOG_FIELD_MESSAGE'), value: messageContent.substring(0, 1024), inline: false }
            )
            .setTimestamp();
          await logChannel.send({ embeds: [logEmbed] }).catch(error => {
            logger.error(`[Say] Failed to send log message to channel ${logChannelId}: `, error);
          });
        }
      }
    } catch (error) {
      logger.error(`[Say] Fehler beim Senden der Nachricht mit /say in Gilde ${interaction.guild.id}:`, error);
      await interaction.editReply({
        content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED_UNEXPECTED', { errorMessage: error.message }),
      });
    }
  }
};