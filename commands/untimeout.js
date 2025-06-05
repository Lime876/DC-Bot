const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Hebt den Timeout eines Mitglieds auf')
    .addUserOption(option =>
      option.setName('mitglied')
        .setDescription('Das Mitglied, dessen Timeout aufgehoben werden soll')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('grund')
        .setDescription('Grund für das Entfernen des Timeouts')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const member = interaction.options.getMember('mitglied');
    const grund = interaction.options.getString('grund') || 'Kein Grund angegeben';

    if (!member) {
      return interaction.reply({ content: '❌ Mitglied nicht gefunden oder nicht auf dem Server.', ephemeral: true });
    }

    try {
      await member.timeout(null, grund);

      const embed = new EmbedBuilder()
        .setColor(0x00FFFF)
        .setTitle('⏱️ Timeout aufgehoben')
        .addFields(
          { name: 'Mitglied', value: `${member.user.tag}`, inline: true },
          { name: 'Von', value: `${interaction.user.tag}`, inline: true },
          { name: 'Grund', value: grund }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      // Optional: Logging
      const logChannelId = process.env.LOG_CHANNEL_ID;
      const logChannel = interaction.guild.channels.cache.get(logChannelId);
      if (logChannel) logChannel.send({ embeds: [embed] }).catch(console.error);
    } catch (error) {
      console.error(error);
      interaction.reply({ content: '❌ Fehler beim Entfernen des Timeouts.', ephemeral: true });
    }
  }
};
