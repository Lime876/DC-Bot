// commands/leaderboard.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const levelsPath = path.join(__dirname, '../data/levels.json');

const loadLevels = () => {
    if (fs.existsSync(levelsPath)) {
        try {
            return JSON.parse(fs.readFileSync(levelsPath, 'utf8'));
        } catch (e) {
            console.error(`Fehler beim Parsen von ${levelsPath}:`, e);
            return {};
        }
    }
    return {};
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Zeigt die Top-Benutzer nach XP an.'),

        category: 'General', // <-- NEU: Füge diese Zeile hinzu

    async execute(interaction) {
        const levelsData = loadLevels(); // Levels-Daten laden
        const guild = interaction.guild;

        // Benutzer-Level in ein Array umwandeln und sortieren
const sortedUsers = Object.entries(levelsData)
    .sort(([, a], [, b]) => {
        if (b.level === a.level) {
            return b.xp - a.xp; // Wenn Level gleich, nach XP sortieren
        }
        return b.level - a.level; // Ansonsten nach Level sortieren
    })
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
