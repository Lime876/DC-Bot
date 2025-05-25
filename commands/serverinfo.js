const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Zeigt Informationen über den Server an'),

  async execute(interaction) {
    const { guild } = interaction;

    const owner = await guild.fetchOwner();
    const members = guild.memberCount;
    const roles = guild.roles.cache.size;
    const channels = guild.channels.cache.size;
    const createdAt = `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`;

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('🛠️ Server-Informationen')
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .addFields(
        { name: '📛 Name', value: guild.name, inline: true },
        { name: '👑 Besitzer', value: `${owner.user.tag}`, inline: true },
        { name: '📅 Erstellt am', value: createdAt, inline: false },
        { name: '👥 Mitglieder', value: `${members}`, inline: true },
        { name: '🧾 Rollen', value: `${roles}`, inline: true },
        { name: '📺 Kanäle', value: `${channels}`, inline: true }
      )
      .setFooter({ text: `Server-ID: ${guild.id}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
