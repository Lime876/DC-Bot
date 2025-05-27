const { SlashCommandBuilder, EmbedBuilder, version: djsVersion } = require('discord.js'); // djsVersion importieren
const os = require('os');
const moment = require('moment');
require('moment-duration-format');
const packageJson = require('../package.json'); // Stellt sicher, dass dieser Pfad korrekt ist

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('Zeigt detaillierte Informationen über den Bot an'),
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
            const userCount = interaction.client.users.cache.size; // Vorsicht: client.users.cache ist nur teilweise gefüllt
            const channelCount = interaction.client.channels.cache.size;

            // Optional: Anzahl der Mitglieder über alle Guilds (genauer, aber kann bei vielen Servern langsam sein)
            // Wenn dein Bot viele Server hat und der Intent `GuildMembers` aktiviert ist:
            // const totalMembers = interaction.client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);

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
                    { name: '⚙️ Discord.js Version', value: `v${discordJsVersion}`, inline: true }, // NEU: Discord.js Version
                    { name: '🌍 Server', value: `${guildCount}`, inline: true }, // NEU: Serveranzahl
                    { name: '👥 Benutzer', value: `${interaction.client.users.cache.size}`, inline: true }, // NEU: Benutzeranzahl (Cached)
                    { name: '💬 Kanäle', value: `${channelCount}`, inline: true }, // NEU: Kanalanzahl
                    { name: '🏓 API Latenz', value: `${interaction.client.ws.ping}ms`, inline: true }, // NEU: API Ping
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
                ephemeral: true,
            });
        }
    },
};