const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Pfad zur changelog.json Datei
const changelogPath = path.join(__dirname, '../changelog.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('changelog')
        .setDescription('Zeigt die neuesten Updates und Änderungen des Bots an.')
        .addStringOption(option =>
            option.setName('version')
                .setDescription('Optionale Versionsnummer, um einen spezifischen Changelog anzuzeigen.')
                .setRequired(false)
        ),
    async execute(interaction) {
        try {
            // Changelog-Daten laden
            const changelogData = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));

            const requestedVersion = interaction.options.getString('version');
            let changelogEntries = [];

            if (requestedVersion) {
                // Suche nach einer spezifischen Version
                const entry = changelogData.find(log => log.version === requestedVersion);
                if (entry) {
                    changelogEntries.push(entry);
                } else {
                    return interaction.reply({ content: `❌ Changelog für Version \`${requestedVersion}\` nicht gefunden.`, ephemeral: true });
                }
            } else {
                // Die letzten 3 Einträge anzeigen
                changelogEntries = changelogData.slice(-3).reverse(); // Die neuesten zuerst
            }

            if (changelogEntries.length === 0) {
                return interaction.reply({ content: 'Keine Changelog-Einträge gefunden.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setColor(0x3498db) // Ein schönes Blau
                .setTitle('📜 Bot Changelog');

            changelogEntries.forEach(entry => {
                const changesList = entry.changes.map(change => `• ${change}`).join('\n');
                embed.addFields({
                    name: `Version ${entry.version} (${entry.date})`,
                    value: changesList,
                    inline: false
                });
            });

            embed.setTimestamp();
            embed.setFooter({ text: 'Für ältere Versionen, nutze /changelog <Version>' });

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Fehler beim Abrufen des Changelogs:', error);
            await interaction.reply({
                content: '❌ Es gab einen Fehler beim Abrufen des Changelogs. Bitte kontaktiere einen Administrator.',
                ephemeral: true,
            });
        }
    },
};