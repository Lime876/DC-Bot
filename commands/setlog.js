const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logPath = path.join(__dirname, '../data/logchannels.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlog')
    .setDescription('Setzt den Kanal für Bot-Logs')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Der Kanal für Logs')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const guildId = interaction.guild.id;

    let logData = {};
    if (fs.existsSync(logPath)) {
      logData = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    }

    logData[guildId] = channel.id;
    fs.writeFileSync(logPath, JSON.stringify(logData, null, 2));

    await interaction.reply(`📘 Logs werden jetzt in <#${channel.id}> gesendet.`);
  },
};
