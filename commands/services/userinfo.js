// commands/utility/userinfo.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Zeigt Informationen über einen Benutzer an')
    .setDescriptionLocalizations({
      de: getTranslatedText('de', 'userinfo_command.DESCRIPTION'),
      'en-US': getTranslatedText('en', 'userinfo_command.DESCRIPTION'),
    })
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Der Benutzer, über den Informationen angezeigt werden sollen')
        .setDescriptionLocalizations({
          de: getTranslatedText('de', 'userinfo_command.USER_OPTION_DESCRIPTION'),
          'en-US': getTranslatedText('en', 'userinfo_command.USER_OPTION_DESCRIPTION'),
        })
        .setRequired(false)
    ),

  category: 'Utility',

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const lang = await getGuildLanguage(interaction.guildId);

    try {
      const user = interaction.options.getUser('user') || interaction.user;
      const member = interaction.guild?.members.cache.get(user.id) || null;

      const formatDate = (date) =>
        date ? `<t:${Math.floor(date.getTime() / 1000)}:F>` : getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED');

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(getTranslatedText(lang, 'userinfo_command.EMBED_TITLE'))
        .setThumbnail(user.displayAvatarURL?.({ size: 256, forceStatic: false }) ?? null)
        .addFields(
          { name: getTranslatedText(lang, 'userinfo_command.FIELD_USER_ID'), value: user.id, inline: false },
          { name: getTranslatedText(lang, 'userinfo_command.FIELD_USERNAME'), value: user.tag, inline: true },
          { name: getTranslatedText(lang, 'userinfo_command.FIELD_IS_BOT'), value: user.bot ? getTranslatedText(lang, 'general.YES') : getTranslatedText(lang, 'general.NO'), inline: true },
          { name: getTranslatedText(lang, 'userinfo_command.FIELD_ACCOUNT_CREATED_AT'), value: formatDate(user.createdAt), inline: false },
        )
        .setTimestamp();

      if (member) {
        embed.addFields(
          { name: getTranslatedText(lang, 'userinfo_command.FIELD_JOINED_SERVER_AT'), value: formatDate(member.joinedAt), inline: false },
          { name: getTranslatedText(lang, 'userinfo_command.FIELD_NICKNAME'), value: member.nickname || getTranslatedText(lang, 'userinfo_command.NO_NICKNAME'), inline: false },
          { name: getTranslatedText(lang, 'userinfo_command.FIELD_VERIFIED'), value: member.pending ? getTranslatedText(lang, 'general.NO') : getTranslatedText(lang, 'general.YES'), inline: true },
          {
            name: getTranslatedText(lang, 'userinfo_command.FIELD_ROLES'),
            value: member.roles.cache
              .filter(r => r.id !== interaction.guild.id)
              .map(r => `<@&${r.id}>`)
              .join(', ') || getTranslatedText(lang, 'userinfo_command.NO_ROLES'),
            inline: false
          },
        );
      }

      await interaction.editReply({ embeds: [embed] });
      logger.info(`[UserInfo Command] Benutzerinformationen für ${user.tag} (${user.id}) in Gilde ${interaction.guild.name} (${interaction.guild.id}) angezeigt. (PID: ${process.pid})`);
    } catch (error) {
      logger.error(`[UserInfo Command] Fehler beim Abrufen der Benutzerinformationen für Gilde ${interaction.guild?.id}:`, error);
      await interaction.editReply({
        content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'),
        ephemeral: true
      });
    }
  },
};