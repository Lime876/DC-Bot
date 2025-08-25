import { SlashCommandBuilder } from 'discord.js';

export async function getYouTubeStats(channelName) {
  // TODO: YouTube API‑Abfrage einbauen
  return {
    channelName,
    subscribers: 5400,
    latestVideo: 'Neues Tutorial: Discord Bot Commands'
  };
}

export const data = new SlashCommandBuilder()
  .setName('youtube')
  .setDescription('Zeigt YouTube‑Kanalinfos an')
  .addStringOption(option =>
    option
      .setName('channel')
      .setDescription('Name des YouTube‑Kanals')
      .setRequired(true)
  );

export async function execute(interaction) {
  const channelName = interaction.options.getString('channel');
  await interaction.deferReply();

  try {
    const stats = await getYouTubeStats(channelName);
    return interaction.editReply(
      `📺 **${stats.channelName}** hat ${stats.subscribers} Abonnenten\nNeustes Video: ${stats.latestVideo}`
    );
  } catch (err) {
    console.error(err);
    return interaction.editReply('❌ Fehler beim Abrufen der YouTube‑Daten.');
  }
}   