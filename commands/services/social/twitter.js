import { SlashCommandBuilder } from 'discord.js';

export async function getTwitterStats(username) {
  // TODO: Hier API‑Call zu Twitter/X einbauen
  return {
    username,
    followers: 120,
    lastTweet: 'Just shipped a new Discord bot feature 🚀'
  };
}

export const data = new SlashCommandBuilder()
  .setName('twitter')
  .setDescription('Zeigt Twitter/X‑Infos zu einem Benutzer an')
  .addStringOption(option =>
    option
      .setName('username')
      .setDescription('Twitter/X‑Benutzername')
      .setRequired(true)
  );

export async function execute(interaction) {
  const username = interaction.options.getString('username');
  await interaction.deferReply();

  try {
    const stats = await getTwitterStats(username);
    return interaction.editReply(
      `🐦 **${stats.username}** hat ${stats.followers} Follower\nLetzter Tweet: ${stats.lastTweet}`
    );
  } catch (err) {
    console.error(err);
    return interaction.editReply('❌ Fehler beim Abrufen der Twitter/X‑Daten.');
  }
}