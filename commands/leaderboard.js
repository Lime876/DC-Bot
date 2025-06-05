// commands/leaderboard.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { loadXP, getUserXP } = require('../utils/economyUtils'); // Oder '../utils/xpUtils', wenn du eine separate Datei verwendest

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Zeigt die Top-Benutzer nach XP an.'),

    async execute(interaction) {
        const xpData = loadXP(); // XP-Daten laden
        const guild = interaction.guild;

        // Benutzer-XP in ein Array umwandeln und sortieren
        const sortedUsers = Object.entries(xpData)
            .sort(([, a], [, b]) => b.xp - a.xp) // Absteigend nach XP sortieren
            .slice(0, 10); // Top 10 Benutzer

        const leaderboardEmbed = new EmbedBuilder()
            .setColor(0xFFA500) // Gold
            .setTitle('🏆 XP Leaderboard')
            .setDescription('Die Top 10 Benutzer auf diesem Server nach XP:')
            .setTimestamp();

        if (sortedUsers.length === 0) {
            leaderboardEmbed.setDescription('Es sind noch keine XP-Daten vorhanden.');
        } else {
            let rank = 1;
            for (const [userId, userData] of sortedUsers) {
                try {
                    const user = await interaction.client.users.fetch(userId); // Benutzerinformationen abrufen
                    leaderboardEmbed.addFields({
                        name: `${rank}. ${user.tag}`,
                        value: `Level: ${userData.level} | XP: ${userData.xp}`,
                        inline: false
                    });
                    rank++;
                } catch (error) {
                    console.error(`Fehler beim Abrufen von Benutzer ${userId}:`, error);
                    // Benutzer nicht gefunden oder anderer Fehler. Füge einen Platzhalter hinzu.
                    leaderboardEmbed.addFields({
                        name: `${rank}. Unbekannter Benutzer`,
                        value: `Level: ${userData.level} | XP: ${userData.xp}`,
                        inline: false
                    });
                    rank++;
                }
            }
        }

        await interaction.reply({ embeds: [leaderboardEmbed] });
    },
};