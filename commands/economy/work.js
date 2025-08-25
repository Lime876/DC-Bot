// commands/work.js — ESM-Version
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { loadEconomy, saveEconomy, getUserData } from '../../utils/economyUtils.js';
import ms from 'ms';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

// Cooldown für /work (z.B. 8 Stunden)
const WORK_COOLDOWN = ms('8h');
const MIN_WORK_AMOUNT = 50;
const MAX_WORK_AMOUNT = 150;

export default {
  data: new SlashCommandBuilder()
    .setName('work')
    .setDescription('Arbeite und verdiene Münzen!')
    .setDescriptionLocalizations({
      de: getTranslatedText('de', 'work_command.DESCRIPTION'),
      'en-US': getTranslatedText('en', 'work_command.DESCRIPTION'),
    }),

  category: 'Economy',

  async execute(interaction) {
    const lang = await getGuildLanguage(interaction.guildId);

    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const economyData = loadEconomy();
    const userData = getUserData(userId, economyData);

    const now = Date.now();
    const lastWork = userData.lastWork || 0;
    const timeLeft = WORK_COOLDOWN - (now - lastWork);

    if (timeLeft > 0) {
      const timeLeftFormatted = ms(timeLeft, { long: true });
      return interaction.editReply({
        content: getTranslatedText(lang, 'work_command.COOLDOWN_ACTIVE', { timeLeft: timeLeftFormatted }),
      });
    }

    const earnedAmount =
      Math.floor(Math.random() * (MAX_WORK_AMOUNT - MIN_WORK_AMOUNT + 1)) + MIN_WORK_AMOUNT;

    userData.balance += earnedAmount;
    userData.lastWork = now; // Cooldown aktualisieren
    saveEconomy(economyData);

    const workEmbed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle(getTranslatedText(lang, 'work_command.EMBED_TITLE'))
      .setDescription(getTranslatedText(lang, 'work_command.EMBED_DESCRIPTION', { earnedAmount }))
      .addFields({
        name: getTranslatedText(lang, 'work_command.FIELD_YOUR_NEW_BALANCE'),
        value: getTranslatedText(lang, 'economy_system.CURRENCY_AMOUNT', { amount: userData.balance }),
        inline: true,
      })
      .setTimestamp()
      .setFooter({ text: getTranslatedText(lang, 'economy_system.FOOTER') });

    await interaction.editReply({ embeds: [workEmbed] });
  },
};