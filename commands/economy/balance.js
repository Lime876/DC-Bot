// commands/balance.js — ESM-Version
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { loadEconomy, getUserData } from '../../utils/economyUtils.js';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Zeigt dein aktuelles Guthaben an oder das eines anderen Benutzers.')
    .setDescriptionLocalizations({
      de: getTranslatedText('de', 'balance_command.DESCRIPTION'),
      'en-US': getTranslatedText('en', 'balance_command.DESCRIPTION'),
    })
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Der Benutzer, dessen Guthaben du sehen möchtest.')
        .setDescriptionLocalizations({
          de: getTranslatedText('de', 'balance_command.USER_OPTION_DESCRIPTION'),
          'en-US': getTranslatedText('en', 'balance_command.USER_OPTION_DESCRIPTION'),
        })
        .setRequired(false),
    ),

  category: 'Economy',

  async execute(interaction) {
    const lang = await getGuildLanguage(interaction.guildId);

    // Sofort antwort zurückstellen
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('user') || interaction.user;
    const economyData = loadEconomy();
    const userData = getUserData(targetUser.id, economyData);

    const balanceEmbed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(
        getTranslatedText(lang, 'balance_command.EMBED_TITLE', { userTag: targetUser.tag }),
      )
      .setDescription(
        getTranslatedText(lang, 'balance_command.EMBED_DESCRIPTION', { balance: userData.balance }),
      )
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setTimestamp()
      .setFooter({ text: getTranslatedText(lang, 'economy_system.FOOTER') });

    await interaction.editReply({ embeds: [balanceEmbed] });
  },
};