const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getGuildLanguage, getTranslatedText } = require('../../utils/languageUtils'); // Stellen Sie sicher, dass der Pfad korrekt ist

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannt einen Benutzer vom Server') // Dies kann auch übersetzt werden, siehe unten
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Der zu bannende Benutzer') // Übersetzbar
        .setRequired(true))
    .addStringOption(option =>
      option.setName('grund')
        .setDescription('Grund für den Ban') // Übersetzbar
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  category: 'Admin',

  async execute(interaction) {
    const lang = interaction.guild ? await getGuildLanguage(interaction.guild.id) : 'en'; // Annahme: getGuildLanguage existiert und holt die Sprache
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('grund') || getTranslatedText(lang, 'ban_command.no_reason_provided'); // Übersetzung hier
    const member = interaction.guild.members.cache.get(target.id);

    if (!member) {
      return interaction.reply({ content: getTranslatedText(lang, 'ban_command.user_not_on_server'), ephemeral: true }); // Übersetzung hier
    }

    if (!member.bannable) {
      return interaction.reply({ content: getTranslatedText(lang, 'ban_command.cannot_ban_user'), ephemeral: true }); // Übersetzung hier
    }

    await member.ban({ reason: reason });

    const embed = new EmbedBuilder()
      .setColor(0x990000)
      .setTitle(getTranslatedText(lang, 'ban_command.ban_embed_title')) // Übersetzung hier
      .addFields(
        { name: getTranslatedText(lang, 'ban_command.field_user'), value: `${target.tag}`, inline: true }, // Übersetzung hier
        { name: getTranslatedText(lang, 'ban_command.field_by'), value: `${interaction.user.tag}`, inline: true }, // Übersetzung hier
        // ACHTUNG: 'user' ist hier nicht definiert, es sollte 'target' sein
        { name: getTranslatedText(lang, 'ban_command.field_id'), value: `${target.id}`, inline: true }, // Übersetzung hier und Korrektur von 'user' zu 'target'
        { name: getTranslatedText(lang, 'ban_command.field_reason'), value: reason } // Übersetzung hier
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    // Optionaler Log
    const logChannelId = process.env.LOG_CHANNEL_ID;
    const logChannel = interaction.guild.channels.cache.get(logChannelId);
    if (logChannel) logChannel.send({ embeds: [embed] }).catch(console.error);
  }
};

// WICHTIG: Sie benötigen eine Funktion, um die Sprache des Guilds abzurufen.
// Angenommen, Sie haben bereits eine `getGuildLanguage` Funktion in `utils/languageUtils.js`
// oder Sie müssen diese implementieren. Zum Beispiel:
/*
// in utils/languageUtils.js
let guildLanguages = {}; // Laden Sie dies aus Ihrer guildLanguages.json

async function getGuildLanguage(guildId) {
    if (guildLanguages[guildId]) {
        return guildLanguages[guildId];
    }
    // Laden Sie hier die Standardsprache oder aus Ihrer Konfigurationsdatei
    return 'en'; // oder 'de', je nachdem, was Ihr Standard ist
}
*/
// Und stellen Sie sicher, dass Sie `getTranslatedText` und `getGuildLanguage` in `ban.js` importieren.
// z.B. const { getTranslatedText, getGuildLanguage } = require('../utils/languageUtils');