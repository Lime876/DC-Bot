// commands/pay.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { loadEconomy, saveEconomy, getUserData } = require('../utils/economyUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pay')
        .setDescription('Überweise Münzen an einen anderen Benutzer.')
        .addUserOption(option =>
            option.setName('ziel_user')
                .setDescription('Der Benutzer, an den du Münzen überweisen möchßen.')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('betrag')
                .setDescription('Der zu überweisende Betrag.')
                .setRequired(true)
                .setMinValue(1)), // Mindestens 1 Münze

    async execute(interaction) {
        const sender = interaction.user;
        const targetUser = interaction.options.getUser('ziel_user');
        const amount = interaction.options.getInteger('betrag');

        if (sender.id === targetUser.id) {
            return interaction.reply({ content: '❌ Du kannst dir selbst keine Münzen überweisen!', ephemeral: true });
        }
        if (targetUser.bot) {
            return interaction.reply({ content: '❌ Du kannst keinem Bot Münzen überweisen!', ephemeral: true });
        }

        const economyData = loadEconomy();
        const senderData = getUserData(sender.id, economyData);
        const targetUserData = getUserData(targetUser.id, economyData);

        if (senderData.balance < amount) {
            return interaction.reply({ content: '❌ Du hast nicht genug Münzen, um diesen Betrag zu überweisen!', ephemeral: true });
        }

        senderData.balance -= amount;
        targetUserData.balance += amount;
        saveEconomy(economyData);

        const payEmbed = new EmbedBuilder()
            .setColor(0x00FF00) // Grün für Erfolg
            .setTitle('💸 Münzen überwiesen!')
            .setDescription(`Du hast **${amount} Münzen** an **${targetUser.tag}** überwiesen.`)
            .addFields(
                { name: 'Dein neues Guthaben', value: `${senderData.balance} Münzen`, inline: true },
                { name: 'Guthaben von Empfänger', value: `${targetUserData.balance} Münzen`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Wirtschaftssystem' });

        await interaction.reply({ embeds: [payEmbed] });
    },
};