// commands/level.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const levelsPath = path.join(__dirname, '../data/levels.json');

// Funktion zum Laden der Leveldaten (wie im messageCreate.js)
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

// Funktion zur Berechnung der benötigten XP für ein bestimmtes Level
const getRequiredXP = (level) => {
    // Diese Formel muss dieselbe sein wie in events/messageCreate.js
    return 5 * Math.pow(level, 2) + 50 * level + 100;
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Zeigt dein aktuelles Level und deine XP an.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Den Level eines anderen Benutzers anzeigen.')
                .setRequired(false)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const levelsData = loadLevels();
        const userData = levelsData[targetUser.id] || { xp: 0, level: 0 };

        const currentXP = userData.xp;
        const currentLevel = userData.level;
        
        // Berechne die benötigten XP für das nächste Level
        const requiredXPForNextLevel = getRequiredXP(currentLevel);
        
        // Berechne die XP, die noch zum nächsten Level fehlen
        const xpToNextLevel = requiredXPForNextLevel - currentXP;

        let description;
        if (currentLevel === 0 && currentXP < requiredXPForNextLevel) {
            description = `XP: **${currentXP} / ${requiredXPForNextLevel}**\n**Noch ${xpToNextLevel} XP bis Level 1!**\nSende Nachrichten, um XP zu verdienen!`;
        } else {
            description = `XP: **${currentXP} / ${requiredXPForNextLevel}**\n**Noch ${xpToNextLevel} XP bis Level ${currentLevel + 1}!**`;
        }
        
        const levelEmbed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle(`📊 Level von ${targetUser.tag}`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: 'Aktuelles Level', value: `**${currentLevel}**`, inline: true },
                { name: 'Fortschritt', value: description, inline: false }
            )
            .setFooter({ text: `Levelsystem powered by ${interaction.client.user.username}` })
            .setTimestamp();

        await interaction.reply({ embeds: [levelEmbed], ephemeral: false });
    },
};