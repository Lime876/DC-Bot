// commands/moderation/clear.js — ESM-Version
import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getLogChannelId } from '../../utils/config.js';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Löscht mehrere Nachrichten im aktuellen Kanal')
    .setDescriptionLocalizations({
      de: getTranslatedText('de', 'clear_command.DESCRIPTION'),
      'en-US': getTranslatedText('en', 'clear_command.DESCRIPTION'),
    })
    .addIntegerOption((option) =>
      option
        .setName('amount')
        .setDescription('Anzahl der zu löschenden Nachrichten (max. 1000)')
        .setDescriptionLocalizations({
          de: getTranslatedText('de', 'clear_command.AMOUNT_OPTION_DESCRIPTION'),
          'en-US': getTranslatedText('en', 'clear_command.AMOUNT_OPTION_DESCRIPTION'),
        })
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  category: 'Moderation',

  async execute(interaction) {
    const lang = await getGuildLanguage(interaction.guildId);
    const amount = interaction.options.getInteger('amount');

    if (amount < 1 || amount > 1000) {
      return interaction.reply({
        content: getTranslatedText(lang, 'clear_command.INVALID_AMOUNT'),
        ephemeral: true,
      });
    }

    try {
      await interaction.deferReply({ ephemeral: true });
      const deleted = await interaction.channel.bulkDelete(amount, true);

      if (deleted.size === 0) {
        await interaction.editReply({
          content: getTranslatedText(lang, 'clear_command.NO_MESSAGES_DELETED'),
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setAuthor({
          name: interaction.user.tag,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setDescription(
          getTranslatedText(lang, 'clear_command.EMBED_DESCRIPTION', {
            deletedCount: deleted.size,
          }),
        )
        .addFields(
          {
            name: getTranslatedText(lang, 'clear_command.FIELD_CHANNEL'),
            value: `<#${interaction.channel.id}>`,
            inline: true,
          },
          {
            name: getTranslatedText(lang, 'clear_command.FIELD_AMOUNT'),
            value: String(deleted.size),
            inline: true,
          },
        )
        .setTimestamp();

      const logChannelId = getLogChannelId(interaction.guild.id);
      if (logChannelId) {
        const logChannel = interaction.guild.channels.cache.get(logChannelId);
        if (logChannel) {
          await logChannel.send({ embeds: [embed] });
        }
      }

      await interaction.editReply({
        content: getTranslatedText(lang, 'clear_command.SUCCESS_MESSAGE', {
          deletedCount: deleted.size,
        }),
      });
    } catch (error) {
      logger.error(
        `[Clear] Fehler beim Löschen von Nachrichten in Gilde ${interaction.guild.id}:`,
        error,
      );
      await interaction.editReply({
        content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED_UNEXPECTED', {
          errorMessage: error.message,
        }),
      });
    }
  },
};