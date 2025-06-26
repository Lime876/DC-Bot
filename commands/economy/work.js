// commands/work.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { loadEconomy, saveEconomy, getUserData } = require('../../utils/economyUtils');
const ms = require('ms'); // Für einfache Zeitumrechnung

// Cooldown für /work (z.B. 8 Stunden)
const WORK_COOLDOWN = ms('8h'); // 8 Stunden
const MIN_WORK_AMOUNT = 50;
const MAX_WORK_AMOUNT = 150;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Arbeite und verdiene Münzen!'),

        category: 'Economy', // <-- NEU: Füge diese Zeile hinzu

    async execute(interaction) {
        const userId = interaction.user.id;
        const economyData = loadEconomy();
        const userData = getUserData(userId, economyData);

        const now = Date.now();
        const lastWork = userData.lastWork || 0;
        const timeLeft = WORK_COOLDOWN - (now - lastWork);

        if (timeLeft > 0) {
            const timeLeftFormatted = ms(timeLeft, { long: true });
            return interaction.reply({ content: `⏳ Du musst noch **${timeLeftFormatted}** warten, bevor du wieder arbeiten kannst.`, ephemeral: true });
        }

        const earnedAmount = Math.floor(Math.random() * (MAX_WORK_AMOUNT - MIN_WORK_AMOUNT + 1)) + MIN_WORK_AMOUNT;
        userData.balance += earnedAmount;
        userData.lastWork = now; // Cooldown aktualisieren
        saveEconomy(economyData);

        const workEmbed = new EmbedBuilder()
            .setColor(0x00FF00) // Grün für Erfolg
            .setTitle('👷 Arbeit erledigt!')
            .setDescription(`Du hast fleißig gearbeitet und **${earnedAmount} Münzen** verdient!`)
            .addFields(
                { name: 'Dein neues Guthaben', value: `${userData.balance} Münzen`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Wirtschaftssystem' });

        await interaction.reply({ embeds: [workEmbed] });
    },
};