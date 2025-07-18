// commands/balance.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { loadEconomy, getUserData } = require('../../utils/economyUtils'); // Importiere die Hilfsfunktionen

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Zeigt dein aktuelles Guthaben an oder das eines anderen Benutzers.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Der Benutzer, dessen Guthaben du sehen möchtest.')
                .setRequired(false)), // Optional: Zeigt das Guthaben eines anderen an

            category: 'Economy', // <-- NEU: Füge diese Zeile hinzu

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const economyData = loadEconomy();
        const userData = getUserData(targetUser.id, economyData); // Stellt sicher, dass Benutzerdaten existieren

        const balanceEmbed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle(`💰 Guthaben von ${targetUser.tag}`)
            .setDescription(`Aktuelles Guthaben: **${userData.balance} Münzen**`) // Wähle eine Währung!
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .setTimestamp()
            .setFooter({ text: 'Wirtschaftssystem' });

        await interaction.reply({ embeds: [balanceEmbed], ephemeral: true });
    },
};