const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const moment = require('moment');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Zeigt Informationen über einen Benutzer an')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Der Benutzer, über den Informationen angezeigt werden sollen')
        .setRequired(false)), // Der User-Parameter ist jetzt optional

  async execute(interaction) {
    // Wenn kein Benutzer angegeben ist, verwende den ausführenden Benutzer
    const user = interaction.options.getUser('user') || interaction.user;
    const member = interaction.guild ? interaction.guild.members.cache.get(user.id) : null;

    // Formatierungsfunktionen für Daten
    const formatDate = (date) => {
      return moment(date).format('DD.MM.YYYY, HH:mm:ss');
    };

    // Erstelle das Embed
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('👤 Benutzerinformationen')
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: ' полной ID', value: user.id, inline: false },
        { name: '📛 Benutzername', value: user.tag, inline: true },
        { name: '🤖 Ist ein Bot', value: user.bot ? 'Ja' : 'Nein', inline: true },
        { name: '📅 Konto erstellt am', value: formatDate(user.createdAt), inline: false },
      )
      .setTimestamp();

    if (member) {
      embed.addFields(
        { name: '📅 Dem Server beigetreten am', value: formatDate(member.joinedAt), inline: false },
        { name: '🎭 Spitzname', value: member.nickname || 'Kein Spitzname', inline: false },
        { name: '✅ Verifiziert', value: member.pending ? 'Nein' : 'Ja', inline: true },
        { name: '⚜️ Rollen', value: member.roles.cache.map(r => `<@&${r.id}>`).join(', ') || 'Keine Rollen', inline: false },
      );
    }
    await interaction.reply({ embeds: [embed] });
  },
};
