// commands/giveaway.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const ms = require('ms'); // Diesen brauchen wir, um Zeitangaben wie "10m" zu parsen

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Startet ein Gewinnspiel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) // Nur für Admins/Moderatoren
        .addStringOption(option =>
            option.setName('dauer')
                .setDescription('Wie lange soll das Gewinnspiel laufen? (z.B. 10m, 1h, 3d)')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('gewinner')
                .setDescription('Anzahl der Gewinner')
                .setRequired(true)
                .setMinValue(1))
        .addStringOption(option =>
            option.setName('preis')
                .setDescription('Was gibt es zu gewinnen?')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('kanal')
                .setDescription('Der Kanal, in dem das Gewinnspiel gepostet werden soll.')
                .setRequired(false) // Optional, wenn kein Kanal angegeben, dann aktueller Kanal
                .addChannelTypes(0)), // Nur Textkanäle (GuildText)

        category: 'Moderation', // <-- NEU: Füge diese Zeile hinzu

    async execute(interaction) {
        const durationString = interaction.options.getString('dauer');
        const winnerCount = interaction.options.getInteger('gewinner');
        const prize = interaction.options.getString('preis');
        const channel = interaction.options.getChannel('kanal') || interaction.channel; // Wenn kein Kanal, dann aktueller Kanal

        const durationMs = ms(durationString);

        if (isNaN(durationMs) || durationMs <= 0) {
            return interaction.reply({ content: '❌ Ungültige Dauerangabe. Bitte verwende Formate wie `10m`, `1h` oder `3d`.', ephemeral: true });
        }

        // Starte das Gewinnspiel
        const giveawayEmbed = new EmbedBuilder()
            .setTitle(prize)
            .setDescription(`Reagiere mit 🎉, um teilzunehmen!\n\n**Gewinner:** ${winnerCount}\n**Endet:** <t:${Math.floor((Date.now() + durationMs) / 1000)}:R>`)
            .setColor('Random')
            .setFooter({ text: '🎉 Gewinnspiel' })
            .setTimestamp(Date.now() + durationMs); // Setzt den Timestamp auf das Ende des Gewinnspiels

        const message = await channel.send({
            embeds: [giveawayEmbed]
        });

        await message.react('🎉');

        await interaction.reply({ content: `✅ Gewinnspiel für **${prize}** in ${channel} gestartet!`, ephemeral: true });

        // Timer für das Gewinnspiel
        setTimeout(async () => {
            try {
                // Fetch the message again to get fresh reactions
                const fetchedMessage = await channel.messages.fetch(message.id);
                const reactions = fetchedMessage.reactions.cache.get('🎉');

                // Überprüfen, ob Reaktionen vorhanden sind
                if (!reactions || reactions.users.cache.size <= 1) { // <= 1, da der Bot selbst reagiert hat
                    const noWinnersEmbed = new EmbedBuilder()
                        .setTitle('Gewinnspiel beendet!')
                        .setDescription(`Niemand hat an dem Gewinnspiel für **${prize}** teilgenommen oder die Teilnahme war zu gering.`)
                        .setColor('Red')
                        .setTimestamp();
                    return channel.send({ embeds: [noWinnersEmbed] });
                }

                // Entferne den Bot aus der Liste der Teilnehmer
                const participants = reactions.users.cache.filter(user => !user.bot);

                if (participants.size === 0) {
                     const noWinnersEmbed = new EmbedBuilder()
                        .setTitle('Gewinnspiel beendet!')
                        .setDescription(`Niemand hat an dem Gewinnspiel für **${prize}** teilgenommen.`)
                        .setColor('Red')
                        .setTimestamp();
                    return channel.send({ embeds: [noWinnersEmbed] });
                }
                
                // Wähle die Gewinner aus
                const winners = participants.random(winnerCount); // `random()` kann ein Array zurückgeben

                const winnerMentions = winners.map(user => `<@${user.id}>`).join(', ');

                const winnersEmbed = new EmbedBuilder()
                    .setTitle('🎉 Gewinnspiel beendet! 🎉')
                    .setDescription(`Herzlichen Glückwunsch an die Gewinner!\n\n**Preis:** ${prize}\n**Gewinner:** ${winnerMentions}`)
                    .setColor('Green')
                    .setFooter({ text: 'Viel Spaß mit dem Gewinn!' })
                    .setTimestamp();

                await channel.send({ content: `Herzlichen Glückwunsch, ${winnerMentions}! Du hast **${prize}** gewonnen!`, embeds: [winnersEmbed] });

            } catch (error) {
                console.error(`Fehler beim Beenden des Gewinnspiels in ${channel.name}:`, error);
                // Optional: Sende eine Fehlermeldung in den Kanal
                await channel.send({ content: `❌ Es gab einen Fehler beim Beenden des Gewinnspiels für "${prize}". Bitte kontaktiere einen Administrator.`, ephemeral: false });
            }
        }, durationMs);
    },
};