// commands/utility/server-stats.js
import { SlashCommandBuilder, EmbedBuilder, ChannelType } from 'discord.js';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('server-stats')
    .setDescription('Zeigt detaillierte Serverstatistiken.')
    .setDescriptionLocalizations({
      de: getTranslatedText('de', 'server_stats_command.DESCRIPTION'),
      'en-US': getTranslatedText('en', 'server_stats_command.DESCRIPTION'),
    })
    .addSubcommand((subcommand) =>
      subcommand
        .setName('overview')
        .setDescription('Zeigt grundlegende Serverstatistiken.')
        .setDescriptionLocalizations({
          de: getTranslatedText('de', 'server_stats_command.OVERVIEW_SUBCOMMAND_DESCRIPTION'),
          'en-US': getTranslatedText('en', 'server_stats_command.OVERVIEW_SUBCOMMAND_DESCRIPTION'),
        })
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('activity')
        .setDescription('Zeigt Aktivitätsstatistiken wie Top-Kanäle und aktivste Nutzer an.')
        .setDescriptionLocalizations({
          de: getTranslatedText('de', 'server_stats_command.ACTIVITY_SUBCOMMAND_DESCRIPTION'),
          'en-US': getTranslatedText('en', 'server_stats_command.ACTIVITY_SUBCOMMAND_DESCRIPTION'),
        })
    ),

  category: 'Utility',

  async execute(interaction) {
    const lang = await getGuildLanguage(interaction.guildId);
    const guild = interaction.guild;

    if (!guild) {
      return interaction.reply({
        content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'),
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();
    const locale = lang === 'de' ? 'de-DE' : 'en-US';
    const nf = new Intl.NumberFormat(locale);

    if (subcommand === 'overview') {
      // Public reply (not ephemeral) so the stats can be seen by everyone
      await interaction.deferReply({ ephemeral: false });

      try {
        // Ensure member cache is populated (requires GUILD_MEMBERS intent)
        await guild.members.fetch();

        const memberCount = guild.members.cache.filter((m) => !m.user.bot).size;
        const botCount = guild.members.cache.filter((m) => m.user.bot).size;
        const totalMembers = guild.memberCount;

        const textChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).size;
        const voiceChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildVoice).size;
        const categories = guild.channels.cache.filter((c) => c.type === ChannelType.GuildCategory).size;

        const roles = guild.roles.cache.size;
        const emojis = guild.emojis.cache.size;
        const owner = await guild.fetchOwner().catch(() => null);

        const createdAtUnix = Math.floor(guild.createdTimestamp / 1000);
        const icon = guild.iconURL({ size: 256, forceStatic: false }) ?? undefined;

        const embed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle(
            getTranslatedText(lang, 'server_stats_command.OVERVIEW_TITLE', { guildName: guild.name })
          )
          .setThumbnail(icon)
          .addFields(
            {
              name: getTranslatedText(lang, 'server_stats_command.FIELD_NAME_MEMBERS'),
              value: nf.format(memberCount),
              inline: true,
            },
            {
              name: getTranslatedText(lang, 'server_stats_command.FIELD_NAME_BOTS'),
              value: nf.format(botCount),
              inline: true,
            },
            {
              name: getTranslatedText(lang, 'server_stats_command.FIELD_NAME_TOTAL'),
              value: nf.format(totalMembers),
              inline: true,
            },
            {
              name: getTranslatedText(lang, 'server_stats_command.FIELD_NAME_TEXT_CHANNELS'),
              value: nf.format(textChannels),
              inline: true,
            },
            {
              name: getTranslatedText(lang, 'server_stats_command.FIELD_NAME_VOICE_CHANNELS'),
              value: nf.format(voiceChannels),
              inline: true,
            },
            {
              name: getTranslatedText(lang, 'server_stats_command.FIELD_NAME_CATEGORIES'),
              value: nf.format(categories),
              inline: true,
            },
            {
              name: getTranslatedText(lang, 'server_stats_command.FIELD_NAME_ROLES'),
              value: nf.format(roles),
              inline: true,
            },
            {
              name: getTranslatedText(lang, 'server_stats_command.FIELD_NAME_EMOJIS'),
              value: nf.format(emojis),
              inline: true,
            },
            {
              name: getTranslatedText(lang, 'server_stats_command.FIELD_NAME_CREATED_AT'),
              value: `<t:${createdAtUnix}:F>`,
              inline: true,
            },
            {
              name: getTranslatedText(lang, 'server_stats_command.FIELD_NAME_OWNER'),
              value: owner ? `${owner.user.tag} (${owner.id})` : getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'),
              inline: true,
            }
          )
          .setTimestamp()
          .setFooter({ text: `Server ID: ${guild.id}` });

        await interaction.editReply({ embeds: [embed] });
        logger.info(`[ServerStats] Übersicht für ${guild.name} (${guild.id}) angezeigt. PID: ${process.pid}`);
      } catch (error) {
        logger.error(`[ServerStats] Fehler für ${guild.id}:`, error);
        // Since the reply is already public, keep the error public here
        await interaction.editReply({
          content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'),
        });
      }
    }

    if (subcommand === 'activity') {
      await interaction.reply({
        content: getTranslatedText(lang, 'server_stats_command.ACTIVITY_DATA_NOTE'),
        ephemeral: true,
      });
      logger.info(`[ServerStats] Aktivität für ${guild.id} angezeigt. PID: ${process.pid}`);
    }
  },
};