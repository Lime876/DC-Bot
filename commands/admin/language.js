// commands/admin/language.js — ESM-Version
import { SlashCommandBuilder, PermissionsBitField } from 'discord.js';
import { getGuildLanguage, setGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';

export default {
  data: new SlashCommandBuilder()
    .setName('language')
    .setDescription('Setzt die Bot-Sprache für diesen Server.')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addStringOption(option =>
      option
        .setName('lang')
        .setDescription('Sprache wählen (z.B. en, de)')
        .setRequired(true)
        .addChoices(
          { name: 'Deutsch', value: 'de' },
          { name: 'English', value: 'en' }
        ),
    ),

  category: 'Admin',

  async execute(interaction) {
    const selectedLang = interaction.options.getString('lang');
    const guildId = interaction.guild.id;
    const currentLang = getGuildLanguage(guildId);

    // Falls Sprache bereits gesetzt ist
    if (selectedLang === currentLang) {
      const alreadySetMsg = getTranslatedText(
        selectedLang,
        'language_command.ALREADY_SET',
        { lang: selectedLang }
      );
      return interaction.reply({ content: alreadySetMsg, ephemeral: true });
    }

    // Sprache setzen und Feedback geben
    if (setGuildLanguage(guildId, selectedLang)) {
      const successMessage = getTranslatedText(
        selectedLang,
        'language_command.SUCCESS_MESSAGE',
        { lang: selectedLang }
      );
      await interaction.reply({ content: successMessage, ephemeral: true });
    } else {
      const errorMessage = getTranslatedText(
        currentLang,
        'language_command.INVALID_LANGUAGE',
        { lang: selectedLang }
      );
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  },
};