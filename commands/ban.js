const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannt einen Benutzer vom Server')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Der zu bannende Benutzer')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('grund')
        .setDescription('Grund für den Ban')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const target = interaction.options.getUser('user');
    const grund = interaction.options.getString('grund') || 'Kein Grund angegeben';
    const member = interaction.guild.members.cache.get(target.id);

    if (!member) {
      return interaction.reply({ content: '❌ Benutzer ist nicht mehr auf dem Server.', ephemeral: true });
    }

    if (!member.bannable) {
      return interaction.reply({ content: '❌ Ich kann diesen Benutzer nicht bannen.', ephemeral: true });
    }

    await member.ban({ reason: grund });

    const embed = new EmbedBuilder()
      .setColor(0x990000)
      .setTitle('🔨 Benutzer gebannt')
      .addFields(
        { name: 'Benutzer', value: `${target.tag}`, inline: true },
        { name: 'Von', value: `${interaction.user.tag}`, inline: true },
        { name: 'ID', value: `${user.id}`, inline: true },
        { name: 'Grund', value: grund }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    // Optionaler Log
    const logChannelId = process.env.LOG_CHANNEL_ID;
    const logChannel = interaction.guild.channels.cache.get(logChannelId);
    if (logChannel) logChannel.send({ embeds: [embed] }).catch(console.error);
  }
};
