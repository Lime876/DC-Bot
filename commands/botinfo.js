const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const os = require('os');
const moment = require('moment');
require('moment-duration-format');
const packageJson = require('../package.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Zeigt Informationen über den Bot an'),
  async execute(interaction) {
    try {
      const duration = moment.duration(process.uptime(), 'seconds').format('D [Tage], H [Stunden], m [Minuten], s [Sekunden]');
      const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

      const cpuModel = os.cpus()[0].model;
      const cpuCores = os.cpus().length;
      const platform = os.platform(); // 'win32', 'linux', 'darwin' etc.
      const arch = os.arch(); // 'x64', 'arm', etc.

      const embed = new EmbedBuilder()
        .setColor(0x00AE86)
        .setTitle('🤖 Bot-Informationen')
        .addFields(
          { name: '🆔 Bot-Name', value: interaction.client.user.tag, inline: true },
          { name: '📅 Erstellt am', value: `<t:${Math.floor(interaction.client.user.createdTimestamp / 1000)}:F>`, inline: true },
          { name: '📡 Uptime', value: duration, inline: true },
          { name: '📁 RAM-Verbrauch', value: `${memoryUsage} MB`, inline: true },
          { name: '🧠 Node.js Version', value: process.version, inline: true },
          { name: '⚙️ Version', value: packageJson.version, inline: true },
          { name: '🧩 Commands geladen', value: `${interaction.client.commands.size}`, inline: true },
          { name: '💻 Plattform', value: `${platform} (${arch})`, inline: true },
          { name: '🖥️ CPU', value: `${cpuModel} (${cpuCores} Kerne)`, inline: true },
          { name: '👤 Entwickler', value: 'Ki, Lime#7543', inline: true }
        )
        .setThumbnail(interaction.client.user.displayAvatarURL())
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
