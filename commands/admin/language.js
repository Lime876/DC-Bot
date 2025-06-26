// commands/admin/language.js
const { SlashCommandBuilder, PermissionsBitField, MessageFlags } = require('discord.js'); // MessageFlags hinzugefügt
const { getGuildLanguage, setGuildLanguage, getTranslatedText } = require('../../utils/languageUtils');
const path = require('path');
const fs = require('fs');

// Pfad zur Datei, in der die Gilden-Sprachen gespeichert werden
const guildLanguagesPath = path.join(__dirname, '../../data/guildLanguages.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('language')
        .setDescription('Sets the bot language for this server.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild) // Erfordert ManageGuild Berechtigung
        .addStringOption(option =>
            option.setName('lang')
                .setDescription('The language to set (e.g., en, de)')
                .setRequired(true)
                .addChoices(
                    { name: 'Deutsch', value: 'de' },
                    { name: 'English', value: 'en' }
                )),
    
    async execute(interaction) {
        const selectedLang = interaction.options.getString('lang');
        const guildId = interaction.guild.id;
        const currentLang = getGuildLanguage(guildId); // Holt die aktuelle Sprache, falls die neue ungültig ist

        // Versucht, die Sprache zu setzen
        if (setGuildLanguage(guildId, selectedLang)) {
            const successMessage = getTranslatedText(selectedLang, 'language_command.SUCCESS_MESSAGE', { lang: selectedLang });
            await interaction.reply({ content: successMessage, flags: [MessageFlags.Ephemeral] }); // Verwendung von flags
        } else {
            const errorMessage = getTranslatedText(currentLang, 'language_command.INVALID_LANGUAGE', { lang: selectedLang });
            await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] }); // Verwendung von flags
        }
    },
};
    