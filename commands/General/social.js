import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import { getAllSocialStats } from '../services/social/index.js';

export const data = new SlashCommandBuilder()
  .setName('social')
  .setDescription('Zeigt kombinierte Social-Media-Stats')
  .addStringOption(option =>
    option.setName('twitter')
      .setDescription('Twitter/X Benutzername')
  )
  .addStringOption(option =>
    option.setName('youtube')
      .setDescription('YouTube Kanal-ID oder Name')
  )
  .addStringOption(option =>
    option.setName('twitch')
      .setDescription('Twitch Benutzername')
  )
  .addChannelOption(option =>
    option
      .setName('zielkanal')
      .setDescription('Kanal, in dem die Nachricht gepostet werden soll')
      .addChannelTypes(ChannelType.GuildText) // nur Textkanäle
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages);

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const twitter = interaction.options.getString('twitter');
  const youtube = interaction.options.getString('youtube');
  const twitch = interaction.options.getString('twitch');
  const zielkanal = interaction.options.getChannel('zielkanal');

  const results = await getAllSocialStats({ twitter, youtubeChannelId: youtube, twitch });

  const lines = results.map(r => {
    if (r.error) return `• ${r.platform}: ⚠️ ${r.error}`;
    if (r.platform === 'Twitter') return `• Twitter (@${r.username}): ${r.followers} Follower`;
    if (r.platform === 'YouTube') return `• YouTube (${r.channelTitle}): ${r.subscribers} Abos`;
    if (r.platform === 'Twitch') return `• Twitch (${r.displayName}): ${r.live ? 'LIVE' : 'offline'}`;
    return '• Unbekannte Plattform';
  });

  const messageText = lines.join('\n');

  // Falls Zielkanal gesetzt ist, dort posten
  if (zielkanal) {
    try {
      await zielkanal.send(messageText);
      await interaction.editReply(`✅ Stats im Kanal ${zielkanal} gepostet.`);
    } catch (err) {
      console.error(err);
      await interaction.editReply(`❌ Konnte nicht im Kanal ${zielkanal} posten.`);
    }
  } else {
    // Wenn kein Zielkanal: direkt in der aktuellen Unterhaltung zurückgeben
    await interaction.editReply({ content: messageText });
  }
}