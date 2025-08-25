// commands/rob.js — ESM-Version
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { loadEconomy, saveEconomy, getUserData } from '../../utils/economyUtils.js';
import ms from 'ms';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

// Cooldown für /rob (z.B. 24 Stunden)
const ROB_COOLDOWN = ms('24h');
// Erfolgschance (z.B. 40 %)
const ROB_SUCCESS_CHANCE = 0.4;
// Anteil des Ziels, der geraubt werden kann (z.B. 10–20 %)
const MIN_ROB_PERCENT = 0.10;
const MAX_ROB_PERCENT = 0.20;
// Strafe bei Misserfolg (z.B. 5 % des eigenen Guthabens)
const ROB_FAILURE_FINE_PERCENT = 0.05;
const MIN_TARGET_BALANCE_TO_ROB = 100;

export default {
  data: new SlashCommandBuilder()
    .setName('rob')
    .setDescription('Versuche, Münzen von einem anderen Benutzer zu stehlen (mit Risiko!).')
    .setDescriptionLocalizations({
      de: getTranslatedText('de', 'rob_command.DESCRIPTION'),
      'en-US': getTranslatedText('en', 'rob_command.DESCRIPTION'),
    })
    .addUserOption(option =>
      option
        .setName('ziel_user')
        .setDescription('Der Benutzer, den du ausrauben möchtest.')
        .setDescriptionLocalizations({
          de: getTranslatedText('de', 'rob_command.TARGET_USER_OPTION_DESCRIPTION'),
          'en-US': getTranslatedText('en', 'rob_command.TARGET_USER_OPTION_DESCRIPTION'),
        })
        .setRequired(true),
    ),

  category: 'Economy',

  async execute(interaction) {
    const lang = await getGuildLanguage(interaction.guildId);

    await interaction.deferReply({ ephemeral: true });

    const robber = interaction.user;
    const targetUser = interaction.options.getUser('ziel_user');

    if (robber.id === targetUser.id) {
      return interaction.editReply({ content: getTranslatedText(lang, 'rob_command.CANNOT_ROB_SELF') });
    }
    if (targetUser.bot) {
      return interaction.editReply({ content: getTranslatedText(lang, 'rob_command.CANNOT_ROB_BOT') });
    }

    const economyData = loadEconomy();
    const robberData = getUserData(robber.id, economyData);
    const targetUserData = getUserData(targetUser.id, economyData);

    const now = Date.now();
    const lastRob = robberData.lastRob || 0;
    const timeLeft = ROB_COOLDOWN - (now - lastRob);

    if (timeLeft > 0) {
      const timeLeftFormatted = ms(timeLeft, { long: true });
      return interaction.editReply({
        content: getTranslatedText(lang, 'rob_command.COOLDOWN_ACTIVE', { timeLeft: timeLeftFormatted }),
      });
    }

    if (targetUserData.balance < MIN_TARGET_BALANCE_TO_ROB) {
      return interaction.editReply({
        content: getTranslatedText(lang, 'rob_command.TARGET_NOT_ENOUGH_BALANCE', {
          userTag: targetUser.tag,
          minBalance: MIN_TARGET_BALANCE_TO_ROB,
        }),
      });
    }

    // Cooldown setzen
    robberData.lastRob = now;

    const success = Math.random() < ROB_SUCCESS_CHANCE;
    let robEmbed;

    if (success) {
      const robbedAmount = Math.floor(
        targetUserData.balance *
          (Math.random() * (MAX_ROB_PERCENT - MIN_ROB_PERCENT) + MIN_ROB_PERCENT),
      );

      targetUserData.balance -= robbedAmount;
      robberData.balance += robbedAmount;

      robEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle(getTranslatedText(lang, 'rob_command.SUCCESS_TITLE'))
        .setDescription(
          getTranslatedText(lang, 'rob_command.SUCCESS_DESCRIPTION', {
            robbedAmount,
            targetUserTag: targetUser.tag,
          }),
        )
        .addFields(
          {
            name: getTranslatedText(lang, 'rob_command.FIELD_YOUR_NEW_BALANCE'),
            value: getTranslatedText(lang, 'economy_system.CURRENCY_AMOUNT', { amount: robberData.balance }),
            inline: true,
          },
          {
            name: getTranslatedText(lang, 'rob_command.FIELD_VICTIM_BALANCE'),
            value: getTranslatedText(lang, 'economy_system.CURRENCY_AMOUNT', { amount: targetUserData.balance }),
            inline: true,
          },
        )
        .setTimestamp()
        .setFooter({ text: getTranslatedText(lang, 'economy_system.FOOTER') });
    } else {
      const fineAmount = Math.floor(robberData.balance * ROB_FAILURE_FINE_PERCENT);
      robberData.balance -= fineAmount;
      if (robberData.balance < 0) robberData.balance = 0;

      robEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(getTranslatedText(lang, 'rob_command.FAILURE_TITLE'))
        .setDescription(
          getTranslatedText(lang, 'rob_command.FAILURE_DESCRIPTION', {
            userTag: targetUser.tag,
            fineAmount,
          }),
        )
        .addFields({
          name: getTranslatedText(lang, 'rob_command.FIELD_YOUR_NEW_BALANCE'),
          value: getTranslatedText(lang, 'economy_system.CURRENCY_AMOUNT', { amount: robberData.balance }),
          inline: true,
        })
        .setTimestamp()
        .setFooter({ text: getTranslatedText(lang, 'economy_system.FOOTER') });
    }

    saveEconomy(economyData);
    await interaction.editReply({ embeds: [robEmbed] });
  },
};