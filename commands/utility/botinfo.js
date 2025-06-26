const { SlashCommandBuilder, EmbedBuilder, MessageFlags, version: djsVersion } = require('discord.js'); // MessageFlags hinzugefügt
const os = require('os');
const moment = require('moment');
require('moment-duration-format');
const packageJson = require('../../package.json'); // Stellt sicher, dass dieser Pfad korrekt ist

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('Zeigt detaillierte Informationen über den Bot an'),

    category: 'Utility', // <-- NEU: Füge diese Zeile hinzu

    async execute(interaction) {
        try {
            // Uptime des Bots
            const duration = moment.duration(process.uptime(), 'seconds').format('D [Tage], H [Stunden], m [Minuten], s [Sekunden]');

            // Speicherverbrauch
            const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

            // CPU-Informationen
            const cpuModel = os.cpus()[0].model;
            const cpuCores = os.cpus().length;
            const platform = os.platform(); // 'win32', 'linux', 'darwin' etc.
            const arch = os.arch(); // 'x64', 'arm', etc.

            // Discord.js Version
            const discordJsVersion = djsVersion;

            // Guilds, User und Channels Count
            const guildCount = interaction.client.guilds.cache.size;
            // Vorsicht: client.users.cache ist nur teilweise gefüllt, es ist besser, memberCount zu verwenden
            // oder alle Benutzer zu fetchen, was bei vielen Servern langsam sein kann.
            // Für eine schnelle Schätzung nehmen wir hier die gecachten User.
            const userCount = interaction.client.users.cache.size; 
            const channelCount = interaction.client.channels.cache.size;

            const embed = new EmbedBuilder()
                .setColor(0x00AE86)
                .setTitle('🤖 Bot-Informationen')
                .setThumbnail(interaction.client.user.displayAvatarURL())
                .addFields(
                    { name: '🆔 Bot-Name', value: interaction.client.user.tag, inline: true },
                    { name: '📅 Erstellt am', value: `<t:${Math.floor(interaction.client.user.createdTimestamp / 1000)}:F>`, inline: true },
                    { name: '🛠️ Version', value: `v${packageJson.version}`, inline: true },
                    { name: '📡 Uptime', value: duration, inline: true },
                    { name: '📁 RAM-Verbrauch', value: `${memoryUsage} MB`, inline: true },
                    { name: '🧠 Node.js Version', value: process.version, inline: true },
                    { name: '⚙️ Discord.js Version', value: `v${discordJsVersion}`, inline: true },
                    { name: '🌍 Server', value: `${guildCount}`, inline: true },
                    { name: '👥 Benutzer', value: `${userCount}`, inline: true }, // Verwendet die gecachte Benutzeranzahl
                    { name: '💬 Kanäle', value: `${channelCount}`, inline: true },
                    { name: '🏓 API Latenz', value: `${interaction.client.ws.ping}ms`, inline: true },
                    { name: '🧩 Commands geladen', value: `${interaction.client.commands.size}`, inline: true },
                    { name: '💻 Plattform', value: `${platform} (${arch})`, inline: true },
                    { name: '🖥️ CPU', value: `${cpuModel} (${cpuCores} Kerne)`, inline: true },
                    { name: '👤 Entwickler', value: 'Ki, Lime#7543', inline: true } // Füge hier deine Namen ein
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Fehler beim Abrufen der Bot-Informationen:', error);
            await interaction.reply({
                content: '❌ Fehler beim Abrufen der Bot-Informationen.',
                flags: [MessageFlags.Ephemeral], // Hier wurde 'ephemeral: true' durch 'flags: [MessageFlags.Ephemeral]' ersetzt
            });
        }
    },
};