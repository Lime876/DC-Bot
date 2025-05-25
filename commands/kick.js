const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kickt einen Benutzer vom Server')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Der zu kickende User')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('grund')
        .setDescription('Grund für den Kick')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction) {
    const target = interaction.options.getUser('user');
    const grund = interaction.options.getString('grund') || 'Kein Grund angegeben';
    const member = interaction.guild.members.cache.get(target.id);

    try {
      if (!member) {
        return interaction.reply({ content: '❌ Benutzer ist nicht mehr auf dem Server.', ephemeral: true });
      }

      if (!member.kickable) {
        return interaction.reply({ content: '❌ Ich kann diesen Benutzer nicht kicken.', ephemeral: true });
      }

      await member.kick(grund);

      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🚪 Benutzer gekickt')
        .addFields(
          { name: 'Benutzer', value: `${target.tag}`, inline: true },
          { name: 'Von', value: `${interaction.user.tag}`, inline: true },
          { name: 'Grund', value: grund }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      // Optional: Log in einen Logchannel senden
      const logChannelId = process.env.LOG_CHANNEL_ID;
      if (logChannelId) {
        const logChannel = interaction.guild.channels.cache.get(logChannelId);
        if (logChannel) {
          await logChannel.send({ embeds: [embed] }).catch(error => {
            console.error("Failed to send log message: ", error);
          });
        }
      }
    } catch (error) {
      console.error('Fehler beim Kicken des Benutzers:', error);
      await interaction.reply({
        content: `❌ Fehler beim Kicken des Benutzers: ${error.message}`,
        ephemeral: true,
      });
    }
  }
};
