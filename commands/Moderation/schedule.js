const { SlashCommandBuilder } = require('discord.js');
const schedule = require('node-schedule');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Plant eine Nachricht für später.')
    .addStringOption(option =>
      option.setName('zeit')
        .setDescription('Zeit im Format YYYY-MM-DD HH:mm')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('nachricht')
        .setDescription('Die Nachricht, die gesendet werden soll')
        .setRequired(true)),

  category: 'Moderation', // <-- NEU: Füge diese Zeile hinzu

  async execute(interaction) {
    const zeit = interaction.options.getString('zeit');
    const nachricht = interaction.options.getString('nachricht');

    const datum = new Date(zeit);
    if (isNaN(datum.getTime())) {
      return interaction.reply({ content: '❌ Ungültiges Zeitformat. Nutze `YYYY-MM-DD HH:mm`', ephemeral: true });
    }

    schedule.scheduleJob(datum, () => {
      interaction.channel.send(`📅 Geplante Nachricht: ${nachricht}`);
    });

    await interaction.reply({ content: `✅ Nachricht geplant für ${datum.toLocaleString()}`, ephemeral: true });
  },
};
