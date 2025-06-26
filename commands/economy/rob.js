// commands/rob.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { loadEconomy, saveEconomy, getUserData } = require('../../utils/economyUtils');
const ms = require('ms');

// Cooldown für /rob (z.B. 24 Stunden)
const ROB_COOLDOWN = ms('24h');
// Erfolgschance (z.B. 40%)
const ROB_SUCCESS_CHANCE = 0.4; // 0.4 = 40%
// Anteil des Ziels, der geraubt werden kann (z.B. 10-20%)
const MIN_ROB_PERCENT = 0.10;
const MAX_ROB_PERCENT = 0.20;
// Strafe bei Misserfolg (z.B. 10% des eigenen Guthabens oder fester Betrag)
const ROB_FAILURE_FINE_PERCENT = 0.05; // 5% des eigenen Guthabens

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rob')
        .setDescription('Versuche, Münzen von einem anderen Benutzer zu stehlen (mit Risiko!).')
        .addUserOption(option =>
            option.setName('ziel_user')
                .setDescription('Der Benutzer, den du ausrauben möchtest.')
                .setRequired(true)),

    category: 'Economy', // <-- NEU: Füge diese Zeile hinzu

    async execute(interaction) {
        const robber = interaction.user;
        const targetUser = interaction.options.getUser('ziel_user');

        if (robber.id === targetUser.id) {
            return interaction.reply({ content: '❌ Du kannst dich nicht selbst ausrauben!', ephemeral: true });
        }
        if (targetUser.bot) {
            return interaction.reply({ content: '❌ Du kannst keinen Bot ausrauben!', ephemeral: true });
        }

        const economyData = loadEconomy();
        const robberData = getUserData(robber.id, economyData);
        const targetUserData = getUserData(targetUser.id, economyData);

        const now = Date.now();
        const lastRob = robberData.lastRob || 0;
        const timeLeft = ROB_COOLDOWN - (now - lastRob);

        if (timeLeft > 0) {
            const timeLeftFormatted = ms(timeLeft, { long: true });
            return interaction.reply({ content: `⏳ Du musst noch **${timeLeftFormatted}** warten, bevor du wieder jemanden ausrauben kannst.`, ephemeral: true });
        }

        if (targetUserData.balance < 100) { // Mindestguthaben des Ziels, um es rentabel zu machen
            return interaction.reply({ content: `❌ ${targetUser.tag} hat nicht genug Münzen zum Ausrauben (mind. 100 Münzen benötigt).`, ephemeral: true });
        }

        robberData.lastRob = now; // Cooldown setzen, egal ob Erfolg oder Misserfolg

        const success = Math.random() < ROB_SUCCESS_CHANCE;
        let robEmbed;

        if (success) {
            const robbedAmount = Math.floor(targetUserData.balance * (Math.random() * (MAX_ROB_PERCENT - MIN_ROB_PERCENT) + MIN_ROB_PERCENT));
            
            targetUserData.balance -= robbedAmount;
            robberData.balance += robbedAmount;

            robEmbed = new EmbedBuilder()
                .setColor(0x00FF00) // Grün für Erfolg
                .setTitle('🚨 Raub erfolgreich!')
                .setDescription(`Du hast **${robbedAmount} Münzen** von **${targetUser.tag}** erbeutet!`)
                .addFields(
                    { name: 'Dein neues Guthaben', value: `${robberData.balance} Münzen`, inline: true },
                    { name: 'Guthaben von Opfer', value: `${targetUserData.balance} Münzen`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Wirtschaftssystem' });

        } else {
            const fineAmount = Math.floor(robberData.balance * ROB_FAILURE_FINE_PERCENT);
            robberData.balance -= fineAmount;
            if (robberData.balance < 0) robberData.balance = 0; // Nicht ins Minus gehen

            robEmbed = new EmbedBuilder()
                .setColor(0xFF0000) // Rot für Misserfolg
                .setTitle('🚔 Raubversuch gescheitert!')
                .setDescription(`Du wurdest bei dem Versuch, ${targetUser.tag} auszurauben, erwischt! Du musstest eine Strafe von **${fineAmount} Münzen** zahlen.`)
                .addFields(
                    { name: 'Dein neues Guthaben', value: `${robberData.balance} Münzen`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Wirtschaftssystem' });
        }

        saveEconomy(economyData);
        await interaction.reply({ embeds: [robEmbed] });
    },
};