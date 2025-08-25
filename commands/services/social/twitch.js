import { SlashCommandBuilder } from 'discord.js';

// 🔹 Servicefunktion (kann auch von index.js oder anderen Commands importiert werden)
export async function getTwitchStats(username) {
  // TODO: Hier kommt deine echte API‑Abfrage rein
  // Beispiel-Dummy-Daten:
  return {
    username,
    isLive: true,
    title: 'Live Coding Discord Bot',
    viewers: 42
  };
}

// 🔹 Slash Command-Definition
export const data = new SlashCommandBuilder()
  .setName('twitch')
  .setDescription('Zeigt Twitch-Stream-Infos zu einem Benutzer an')
  .addStringOption(option =>
    option
      .setName('username')
      .setDescription('Twitch-Benutzername')
      .setRequired(true)
  );

// 🔹 Slash Command-Handler
export async function execute(interaction) {
  const username = interaction.options.getString('username');

  await interaction.deferReply();

  try {
    const stats = await getTwitchStats(username);

    if (!stats || !stats.isLive) {
      return interaction.editReply(`📴 ${username} ist derzeit nicht live.`);
    }

    return interaction.editReply(
      `🎥 **${stats.username}** ist live: ${stats.title} — 👥 ${stats.viewers} Zuschauer`
    );
  } catch (err) {
    console.error(err);
    return interaction.editReply('❌ Fehler beim Abrufen der Twitch-Daten.');
  }
}