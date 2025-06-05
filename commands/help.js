const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Zeigt alle verfügbaren Befehle in Seitenform'),

  async execute(interaction) {
    try {
      const commands = [...interaction.client.commands.values()];
      const perPage = 5;
      const totalPages = Math.ceil(commands.length / perPage);
      let currentPage = 0;

      // Funktion: Embed für Seite X erstellen
      const generateEmbed = (page) => {
        const start = page * perPage;
        const end = start + perPage;
        const currentCommands = commands.slice(start, end);

        const embed = new EmbedBuilder()
          .setTitle('📖 Hilfe – Slash Commands')
          .setColor(0x00AE86)
          .setFooter({ text: `Seite ${page + 1} von ${totalPages}` })
          .setTimestamp();

        currentCommands.forEach(cmd => {
          embed.addFields({
            name: `/${cmd.data.name}`,
            value: cmd.data.description || 'Keine Beschreibung',
          });
        });

        return embed;
      };

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('prev')
          .setLabel('⬅️ Zurück')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('next')
          .setLabel('➡️ Weiter')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(totalPages <= 1)
      );

      const message = await interaction.reply({
        embeds: [generateEmbed(currentPage)],
        components: [row],
        ephemeral: true,
        fetchReply: true,
      });

      const collector = message.createMessageComponentCollector({
        time: 60_000, // 60 Sekunden aktiv
      });

      collector.on('collect', async i => {
        try{
          if (i.user.id !== interaction.user.id) {
            return i.reply({ content: '❌ Nur der ursprüngliche Nutzer kann blättern.', ephemeral: true });
          }

          if (i.customId === 'prev') currentPage--;
          else if (i.customId === 'next') currentPage++;

          // Buttons updaten
          row.components[0].setDisabled(currentPage === 0);
          row.components[1].setDisabled(currentPage >= totalPages - 1);

          await i.update({
            embeds: [generateEmbed(currentPage)],
            components: [row],
          });
        } catch(error){
          console.error("Error during button click", error);
          await i.reply({content: "❌ An error occurred while processing your request", ephemeral: true});
        }

      });

      collector.on('end', () => {
        message.edit({ components: [] }).catch(() => {});
      });
    } catch (error) {
      console.error('Fehler beim Anzeigen der Hilfe:', error);
      await interaction.reply({
        content: '❌ Fehler beim Anzeigen der Hilfe.',
        ephemeral: true,
      });
    }
  },
};
