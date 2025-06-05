const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rejoin-rollen')
    .setDescription('Aktiviere oder deaktiviere das automatische Wiedergeben alter Rollen beim Join')
    .addStringOption(option =>
      option
        .setName('aktion')
        .setDescription('Aktivieren oder deaktivieren')
        .setRequired(true)
        .addChoices(
          { name: 'aktivieren', value: 'on' },
          { name: 'deaktivieren', value: 'off' }
        ))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const aktion = interaction.options.getString('aktion');
    const settingsPath = path.join(__dirname, '../data/rejoinSettings.json');

    let settings = {};
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }

    if (aktion === 'on') {
      settings[interaction.guild.id] = interaction.channel.id;
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      await interaction.reply({ content: '✅ Rollen-Wiederherstellung **aktiviert**. Logs werden in diesem Channel gesendet.', ephemeral: true });
    } else {
      delete settings[interaction.guild.id];
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      await interaction.reply({ content: '❌ Rollen-Wiederherstellung **deaktiviert**.', ephemeral: true });
    }
  }
};
