// commands/leaderboard.js — ESM-Version
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

// __dirname in ESM definieren
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const levelsPath = path.join(__dirname, '../../data/levels.json');

const loadLevels = () => {
  if (fs.existsSync(levelsPath)) {
    try {
      return JSON.parse(fs.readFileSync(levelsPath, 'utf8'));
    } catch (e) {
      logger.error(`[Leaderboard] Fehler beim Parsen von ${levelsPath}:`, e);
      return {};
    }
  }
  return {};
};

export default {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Zeigt die Top-Benutzer nach XP an.')
    .setDescriptionLocalizations({
      de: getTranslatedText('de', 'leaderboard_command.DESCRIPTION'),
      'en-US': getTranslatedText('en', 'leaderboard_command.DESCRIPTION'),
    }),

  category: 'Economy',

  async execute(interaction) {
    const lang = await getGuildLanguage(interaction.guildId);

    await interaction.deferReply({ ephemeral: true });

    const levelsData = loadLevels();

    const sortedUsers = Object.entries(levelsData)
      .sort(([, a], [, b]) => {
        if (b.level === a.level) {
          return b.xp - a.xp;
        }
        return b.level - a.level;
      })
      .slice(0, 10); // Top 10

    const leaderboardEmbed = new EmbedBuilder()
      .setColor(0xffa500) // Gold
      .setTitle(getTranslatedText(lang, 'leaderboard_command.EMBED_TITLE'))
      .setTimestamp();

    if (sortedUsers.length === 0) {
      leaderboardEmbed.setDescription(getTranslatedText(lang, 'leaderboard_command.NO_XP_DATA'));
    } else {
      leaderboardEmbed.setDescription(getTranslatedText(lang, 'leaderboard_command.EMBED_DESCRIPTION'));
      let rank = 1;
      for (const [userId, userData] of sortedUsers) {
        try {
          const user = await interaction.client.users.fetch(userId);
          leaderboardEmbed.addFields({
            name: getTranslatedText(lang, 'leaderboard_command.FIELD_RANK_USER', {
              rank: rank,
              userTag: user.tag,
            }),
            value: getTranslatedText(lang, 'leaderboard_command.FIELD_VALUE_XP_LEVEL', {
              level: userData.level,
              xp: userData.xp,
            }),
            inline: false,
          });
        } catch (error) {
          logger.error(`[Leaderboard] Fehler beim Abrufen von Benutzer ${userId}:`, error);
          leaderboardEmbed.addFields({
            name: getTranslatedText(lang, 'leaderboard_command.FIELD_RANK_UNKNOWN_USER', { rank }),
            value: getTranslatedText(lang, 'leaderboard_command.FIELD_VALUE_XP_LEVEL', {
              level: userData.level,
              xp: userData.xp,
            }),
            inline: false,
          });
        }
        rank++;
      }
    }

    await interaction.editReply({ embeds: [leaderboardEmbed] });
  },
};