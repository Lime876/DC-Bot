// events/channelDelete.js (Beispiel für die Korrektur)
const { Events, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ... (deine bestehenden Funktionen zum Laden/Speichern von ticketConfig und activeTickets) ...

module.exports = {
    name: Events.ChannelDelete,
    async execute(channel, client) {
        // Ignoriere DMs
        if (!channel.guild) return;

        const guildId = channel.guild.id;
        const activeTicketsPath = path.join(__dirname, '../data/activeTickets.json');
        const configPath = path.join(__dirname, '../data/ticketConfig.json');

        const loadActiveTickets = () => {
            if (fs.existsSync(activeTicketsPath)) {
                return JSON.parse(fs.readFileSync(activeTicketsPath, 'utf8'));
            }
            return {};
        };
        const saveActiveTickets = (tickets) => {
            fs.writeFileSync(activeTicketsPath, JSON.stringify(tickets, null, 2));
        };
        const loadConfig = () => {
            if (fs.existsSync(configPath)) {
                return JSON.parse(fs.readFileSync(configPath, 'utf8'));
            }
            return {};
        };


        // Wenn der gelöschte Kanal ein aktives Ticket ist, entferne es aus der Liste
        let activeTickets = loadActiveTickets();
        if (activeTickets[channel.id]) {
            const ticketInfo = activeTickets[channel.id];
            delete activeTickets[channel.id];
            saveActiveTickets(activeTickets);

            console.log(`Gelöschtes Ticket ${channel.name} (${channel.id}) aus der aktiven Liste entfernt.`);

            // Optionale Protokollierung in einem Log-Kanal
            const guildConfig = loadConfig()[guildId];
            if (guildConfig && guildConfig.logChannelId) {
                const logChannel = channel.guild.channels.cache.get(guildConfig.logChannelId);
                if (logChannel) {
                    const embed = new EmbedBuilder()
                        .setColor(0xFF0000) // Rot
                        .setTitle('🗑️ Ticket-Kanal gelöscht')
                        .setDescription(`Ein Ticket-Kanal wurde gelöscht.`)
                        .addFields(
                            { name: 'Kanalname', value: `${channel.name}`, inline: true },
                            { name: 'Kanal-ID', value: `\`${channel.id}\``, inline: true },
                            { name: 'Ticket eröffnet von', value: `<@${ticketInfo.userId}>`, inline: true },
                            // Hier ist der Fehler wahrscheinlich: Stelle sicher, dass der Wert ein String ist
                            { name: 'Position', value: `\`${channel.rawPosition}\`` || 'Nicht verfügbar', inline: true }, // **Korrektur hier!**
                            { name: 'Kategorie', value: channel.parent ? channel.parent.name : 'Keine', inline: true },
                        )
                        .setTimestamp();
                    await logChannel.send({ embeds: [embed] }).catch(console.error);
                }
            }
        }
    },
};