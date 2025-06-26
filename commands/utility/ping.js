const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Zeigt die Latenz zum Bot und zur API'),

  category: 'Utility', // <-- NEU: Füge diese Zeile hinzu

  async execute(interaction) {
    const sent = await interaction.reply({ content: '🏓 Ping wird berechnet...', fetchReply: true });

    const botPing = sent.createdTimestamp - interaction.createdTimestamp;
    const apiPing = interaction.client.ws.ping;

    await interaction.editReply(`🏓 Pong!\nBot-Latenz: **${botPing}ms**\nAPI-Latenz: **${apiPing}ms**`);
  },
};
