// commands/level.js — ESM-Version
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

// __dirname in ESM ermitteln
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const levelsPath = path.join(__dirname, '../../data/levels.json');

// Leveldaten laden
const loadLevels = () => {
  if (fs.existsSync(levelsPath)) {
    try {
      return JSON.parse(fs.readFileSync(levelsPath, 'utf8'));
    } catch (e) {
      logger.error(`[Level] Fehler beim Parsen von ${levelsPath}:`, e);
      return {};
    }
  }
  return {};
};

// XP‑Formel (muss identisch sein zu events/messageCreate.js)
const getRequiredXP = (level) => 5 * Math.pow(level, 2) + 50 * level + 100;

export default {
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('Zeigt dein aktuelles Level und deine XP an.')
    .setDescriptionLocalizations({
      de: getTranslatedText('de', 'level_command.DESCRIPTION'),
      'en-US': getTranslatedText('en', 'level_command.DESCRIPTION'),
    })
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Den Level eines anderen Benutzers anzeigen.')
        .setDescriptionLocalizations({
          de: getTranslatedText('de', 'level_command.USER_OPTION_DESCRIPTION'),
          'en-US': getTranslatedText('en', 'level_command.USER_OPTION_DESCRIPTION'),
        })
        .setRequired(false),
    ),

  category: 'General',

  async execute(interaction) {
    const lang = await getGuildLanguage(interaction.guildId);

    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('user') || interaction.user;
    const levelsData = loadLevels();
    const userData = levelsData[targetUser.id] || { xp: 0, level: 0 };

    const currentXP = userData.xp;
    const currentLevel = userData.level;

    const requiredXPForNextLevel = getRequiredXP(currentLevel);
    const xpToNextLevel = requiredXPForNextLevel - currentXP;

    let description;
    if (currentLevel === 0 && currentXP < requiredXPForNextLevel) {
      description = getTranslatedText(lang, 'level_command.INITIAL_PROGRESS_DESCRIPTION', {
        currentXP,
        requiredXP: requiredXPForNextLevel,
        xpToNextLevel,
      });
    } else {
      description = getTranslatedText(lang, 'level_command.PROGRESS_DESCRIPTION', {
        currentXP,
        requiredXP: requiredXPForNextLevel,
        xpToNextLevel,
        nextLevel: currentLevel + 1,
      });
    }

    const levelEmbed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(getTranslatedText(lang, 'level_command.EMBED_TITLE', { userTag: targetUser.tag }))
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .addFields(
        {
          name: getTranslatedText(lang, 'level_command.FIELD_CURRENT_LEVEL'),
          value: `**${currentLevel}**`,
          inline: true,
        },
        {
          name: getTranslatedText(lang, 'level_command.FIELD_PROGRESS'),
          value: description,
          inline: false,
        },
      )
      .setFooter({
        text: getTranslatedText(lang, 'level_command.FOOTER_TEXT', {
          botUsername: interaction.client.user.username,
        }),
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [levelEmbed] });
  },
};