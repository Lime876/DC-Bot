const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Entbannt einen Benutzer über die Benutzer-ID')
    .addStringOption(option =>
      option.setName('userid')
        .setDescription('Die ID des Benutzers, der entbannt werden soll')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('grund')
        .setDescription('Grund für das Entbannen')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const userId = interaction.options.getString('userid');
    const grund = interaction.options.getString('grund') || 'Kein Grund angegeben';

    try {
      const ban = await interaction.guild.bans.fetch(userId);
      if (!ban) {
        return interaction.reply({ content: '❌ Benutzer ist nicht gebannt.', ephemeral: true });
      }

      await interaction.guild.members.unban(userId, grund);

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🔓 Benutzer entbannt')
        .addFields(
          { name: 'Benutzer-ID', value: userId, inline: true },
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
      return interaction.reply({ content: '❌ Fehler beim Entbannen. Stelle sicher, dass die ID korrekt ist.', ephemeral: true });
    }
  }
};
