// commands/general/changelog.js — ESM-Version
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

// __dirname in ESM bereitstellen
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pfad zur changelog.json Datei
const changelogPath = path.join(__dirname, '../changelog.json');

export default {
  data: new SlashCommandBuilder()
    .setName('changelog')
    .setDescription('Zeigt die neuesten Updates und Änderungen des Bots an.')
    .setDescriptionLocalizations({
      de: getTranslatedText('de', 'changelog_command.DESCRIPTION'),
      'en-US': getTranslatedText('en', 'changelog_command.DESCRIPTION'),
    })
    .addStringOption(option =>
      option
        .setName('version')
        .setDescription('Optionale Versionsnummer, um einen spezifischen Changelog anzuzeigen.')
        .setDescriptionLocalizations({
          de: getTranslatedText('de', 'changelog_command.VERSION_OPTION_DESCRIPTION'),
          'en-US': getTranslatedText('en', 'changelog_command.VERSION_OPTION_DESCRIPTION'),
        })
        .setRequired(false),
    ),

  category: 'General',

  async execute(interaction) {
    const lang = await getGuildLanguage(interaction.guildId);

    await interaction.deferReply({ ephemeral: true });

    try {
      // Changelog-Daten laden
      const changelogData = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));

      const requestedVersion = interaction.options.getString('version');
      let changelogEntries = [];

      if (requestedVersion) {
        const entry = changelogData.find(log => log.version === requestedVersion);
        if (entry) {
          changelogEntries.push(entry);
        } else {
          return interaction.editReply({
            content: getTranslatedText(lang, 'changelog_command.VERSION_NOT_FOUND', { version: requestedVersion }),
          });
        }
      } else {
        // Die letzten 3 Einträge anzeigen
        changelogEntries = changelogData.slice(-3).reverse();
      }

      if (changelogEntries.length === 0) {
        return interaction.editReply({
          content: getTranslatedText(lang, 'changelog_command.NO_ENTRIES_FOUND'),
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(getTranslatedText(lang, 'changelog_command.EMBED_TITLE'));

      changelogEntries.forEach(entry => {
        const changesList = entry.changes.map(change => `• ${change}`).join('\n');
        embed.addFields({
          name: getTranslatedText(lang, 'changelog_command.FIELD_VERSION_DATE', {
            version: entry.version,
            date: entry.date,
          }),
          value: changesList,
          inline: false,
        });
      });

      embed.setTimestamp();
      embed.setFooter({ text: getTranslatedText(lang, 'changelog_command.FOOTER_HINT') });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error(`[Changelog] Fehler beim Abrufen des Changelogs in Gilde ${interaction.guild.id}:`, error);
      await interaction.editReply({
        content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED_UNEXPECTED', {
          errorMessage: error.message,
        }),
      });
    }
  },
};