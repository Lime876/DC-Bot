const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Gibt einem Benutzer einen Timeout (Stummschaltung)')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Der Benutzer, der getimeoutet werden soll')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('dauer')
        .setDescription('Dauer des Timeouts in Minuten (max. 43200 = 30 Tage)')
        .setMinValue(1)
        .setMaxValue(43200)
        .setRequired(true))
    .addStringOption(option =>
      option.setName('grund')
        .setDescription('Grund für den Timeout')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const dauer = interaction.options.getInteger('dauer');
    const grund = interaction.options.getString('grund') || 'Kein Grund angegeben';
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
      return interaction.reply({ content: '❌ Benutzer ist nicht mehr auf dem Server.', ephemeral: true });
    }

    if (!member.moderatable) {
      return interaction.reply({ content: '❌ Ich kann diesem Benutzer keinen Timeout geben.', ephemeral: true });
    }

    const timeoutMs = dauer * 60 * 1000;

    await member.timeout(timeoutMs, grund);

    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle('⏱️ Benutzer getimeoutet')
      .addFields(
        { name: 'Benutzer', value: `${user.tag}`, inline: true },
        { name: 'Von', value: `${interaction.user.tag}`, inline: true },
        { name: 'Dauer', value: `${dauer} Minute(n)`, inline: true },
        { name: 'Grund', value: grund }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    // Optional: Logging in den Log-Channel
    const logChannelId = process.env.LOG_CHANNEL_ID;
    const logChannel = interaction.guild.channels.cache.get(logChannelId);
    if (logChannel) logChannel.send({ embeds: [embed] }).catch(console.error);
  }
};
