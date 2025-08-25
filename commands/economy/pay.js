// commands/pay.js — ESM-Version
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { loadEconomy, saveEconomy, getUserData } from '../../utils/economyUtils.js';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Überweise Münzen an einen anderen Benutzer.')
    .setDescriptionLocalizations({
      de: getTranslatedText('de', 'pay_command.DESCRIPTION'),
      'en-US': getTranslatedText('en', 'pay_command.DESCRIPTION'),
    })
    .addUserOption(option =>
      option
        .setName('ziel_user')
        .setDescription('Der Benutzer, an den du Münzen überweisen möchtest.')
        .setDescriptionLocalizations({
          de: getTranslatedText('de', 'pay_command.TARGET_USER_OPTION_DESCRIPTION'),
          'en-US': getTranslatedText('en', 'pay_command.TARGET_USER_OPTION_DESCRIPTION'),
        })
        .setRequired(true),
    )
    .addIntegerOption(option =>
      option
        .setName('betrag')
        .setDescription('Der zu überweisende Betrag.')
        .setDescriptionLocalizations({
          de: getTranslatedText('de', 'pay_command.AMOUNT_OPTION_DESCRIPTION'),
          'en-US': getTranslatedText('en', 'pay_command.AMOUNT_OPTION_DESCRIPTION'),
        })
        .setRequired(true)
        .setMinValue(1),
    ),

  category: 'Economy',

  async execute(interaction) {
    const lang = await getGuildLanguage(interaction.guildId);

    await interaction.deferReply({ ephemeral: true });

    const sender = interaction.user;
    const targetUser = interaction.options.getUser('ziel_user');
    const amount = interaction.options.getInteger('betrag');

    if (sender.id === targetUser.id) {
      return interaction.editReply({ content: getTranslatedText(lang, 'pay_command.CANNOT_PAY_SELF') });
    }
    if (targetUser.bot) {
      return interaction.editReply({ content: getTranslatedText(lang, 'pay_command.CANNOT_PAY_BOT') });
    }

    const economyData = loadEconomy();
    const senderData = getUserData(sender.id, economyData);
    const targetUserData = getUserData(targetUser.id, economyData);

    if (senderData.balance < amount) {
      return interaction.editReply({ content: getTranslatedText(lang, 'pay_command.NOT_ENOUGH_BALANCE') });
    }

    senderData.balance -= amount;
    targetUserData.balance += amount;
    saveEconomy(economyData);

    const payEmbed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle(getTranslatedText(lang, 'pay_command.EMBED_TITLE'))
      .setDescription(
        getTranslatedText(lang, 'pay_command.EMBED_DESCRIPTION', {
          amount,
          targetUserTag: targetUser.tag,
        }),
      )
      .addFields(
        {
          name: getTranslatedText(lang, 'pay_command.FIELD_YOUR_NEW_BALANCE'),
          value: getTranslatedText(lang, 'economy_system.CURRENCY_AMOUNT', { amount: senderData.balance }),
          inline: true,
        },
        {
          name: getTranslatedText(lang, 'pay_command.FIELD_RECEIVER_BALANCE'),
          value: getTranslatedText(lang, 'economy_system.CURRENCY_AMOUNT', { amount: targetUserData.balance }),
          inline: true,
        },
      )
      .setTimestamp()
      .setFooter({ text: getTranslatedText(lang, 'economy_system.FOOTER') });

    await interaction.editReply({ embeds: [payEmbed] });
  },
};