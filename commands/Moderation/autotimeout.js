// commands/moderation/autotimeout.js — ESM-Version (fix)
import { SlashCommandBuilder, PermissionsBitField, EmbedBuilder, ChannelType } from 'discord.js';
import ms from 'ms';
import { getGuildAutotimeoutConfig, setGuildAutotimeoutConfig } from '../../utils/autotimeoutConfig.js';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('autotimeout')
    .setDescription('Verwaltet die Einstellungen für automatische Timeouts bei Spam-Verstößen.')
    .setDescriptionLocalizations({
      de: getTranslatedText('de', 'autotimeout_command.DESCRIPTION'),
      'en-US': getTranslatedText('en', 'autotimeout_command.DESCRIPTION'),
    })
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('enable')
        .setDescription('Aktiviert automatische Timeouts.')
        .setDescriptionLocalizations({
          de: getTranslatedText('de', 'autotimeout_command.ENABLE_SUBCOMMAND_DESCRIPTION'),
          'en-US': getTranslatedText('en', 'autotimeout_command.ENABLE_SUBCOMMAND_DESCRIPTION'),
        }),
    )
    .addSubcommand((sub) =>
      sub
        .setName('disable')
        .setDescription('Deaktiviert automatische Timeouts.')
        .setDescriptionLocalizations({
          de: getTranslatedText('de', 'autotimeout_command.DISABLE_SUBCOMMAND_DESCRIPTION'),
          'en-US': getTranslatedText('en', 'autotimeout_command.DISABLE_SUBCOMMAND_DESCRIPTION'),
        }),
    )
    .addSubcommand((sub) =>
      sub
        .setName('set_duration')
        .setDescription('Legt die Dauer für automatische Timeouts fest (z.B. "10m", "1h").')
        .setDescriptionLocalizations({
          de: getTranslatedText('de', 'autotimeout_command.SET_DURATION_SUBCOMMAND_DESCRIPTION'),
          'en-US': getTranslatedText('en', 'autotimeout_command.SET_DURATION_SUBCOMMAND_DESCRIPTION'),
        })
        .addStringOption((opt) =>
          opt
            .setName('duration')
            .setDescription('Die Dauer (z.B. "10m", "1h", "1d"). Max. 28 Tage.')
            .setDescriptionLocalizations({
              de: getTranslatedText('de', 'autotimeout_command.DURATION_OPTION_DESCRIPTION'),
              'en-US': getTranslatedText('en', 'autotimeout_command.DURATION_OPTION_DESCRIPTION'),
            })
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('set_violations')
        .setDescription('Legt die Anzahl der Spam-Verstöße fest, bevor ein automatischer Timeout erfolgt.')
        .setDescriptionLocalizations({
          de: getTranslatedText('de', 'autotimeout_command.SET_VIOLATIONS_SUBCOMMAND_DESCRIPTION'),
          'en-US': getTranslatedText('en', 'autotimeout_command.SET_VIOLATIONS_SUBCOMMAND_DESCRIPTION'),
        })
        .addIntegerOption((opt) =>
          opt
            .setName('count')
            .setDescription('Anzahl der Verstöße (z.B. 3).')
            .setDescriptionLocalizations({
              de: getTranslatedText('de', 'autotimeout_command.VIOLATIONS_COUNT_OPTION_DESCRIPTION'),
              'en-US': getTranslatedText('en', 'autotimeout_command.VIOLATIONS_COUNT_OPTION_DESCRIPTION'),
            })
            .setRequired(true)
            .setMinValue(1),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('set_log_channel')
        .setDescription('Legt den Log-Kanal für automatische Timeout-Aktionen fest.')
        .setDescriptionLocalizations({
          de: getTranslatedText('de', 'autotimeout_command.SET_LOG_CHANNEL_SUBCOMMAND_DESCRIPTION'),
          'en-US': getTranslatedText('en', 'autotimeout_command.SET_LOG_CHANNEL_SUBCOMMAND_DESCRIPTION'),
        })
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Der Textkanal, in den Logs gesendet werden sollen (optional, leer lassen zum Entfernen).')
            .setDescriptionLocalizations({
              de: getTranslatedText('de', 'autotimeout_command.LOG_CHANNEL_OPTION_DESCRIPTION'),
              'en-US': getTranslatedText('en', 'autotimeout_command.LOG_CHANNEL_OPTION_DESCRIPTION'),
            })
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('Zeigt die aktuellen Einstellungen für automatische Timeouts an.')
        .setDescriptionLocalizations({
          de: getTranslatedText('de', 'autotimeout_command.STATUS_SUBCOMMAND_DESCRIPTION'),
          'en-US': getTranslatedText('en', 'autotimeout_command.STATUS_SUBCOMMAND_DESCRIPTION'),
        }),
    ),

  category: 'Moderation',

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const lang = await getGuildLanguage(guildId);
    let config = getGuildAutotimeoutConfig(guildId) ?? {};
    const subcommand = interaction.options.getSubcommand();

    await interaction.deferReply({ ephemeral: true });

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.editReply({
        content: getTranslatedText(lang, 'permissions.MISSING_PERMISSION_SINGULAR', {
          permission: getTranslatedText(lang, 'permissions.MANAGE_GUILD'),
        }),
      });
    }

    switch (subcommand) {
      case 'enable': {
        if (config.enabled) {
          return interaction.editReply({
            content: getTranslatedText(lang, 'autotimeout_command.ALREADY_ENABLED'),
          });
        }
        setGuildAutotimeoutConfig(guildId, { enabled: true });
        return interaction.editReply({
          content: getTranslatedText(lang, 'autotimeout_command.ENABLED_SUCCESS'),
        });
      }

      case 'disable': {
        if (!config.enabled) {
          return interaction.editReply({
            content: getTranslatedText(lang, 'autotimeout_command.ALREADY_DISABLED'),
          });
        }
        setGuildAutotimeoutConfig(guildId, { enabled: false });
        return interaction.editReply({
          content: getTranslatedText(lang, 'autotimeout_command.DISABLED_SUCCESS'),
        });
      }

      case 'set_duration': {
        const durationString = interaction.options.getString('duration');
        const durationMs = ms(durationString);
        const maxDurationMs = ms('28d');

        if (!durationMs || durationMs <= 0 || durationMs > maxDurationMs) {
          return interaction.editReply({
            content: getTranslatedText(lang, 'autotimeout_command.INVALID_DURATION', {
              maxDuration: ms(maxDurationMs, { long: true }),
            }),
          });
        }
        setGuildAutotimeoutConfig(guildId, { durationMs });
        return interaction.editReply({
          content: getTranslatedText(lang, 'autotimeout_command.DURATION_SET_SUCCESS', {
            duration: ms(durationMs, { long: true }),
          }),
        });
      }

      case 'set_violations': {
        const violationsCount = interaction.options.getInteger('count');
        if (violationsCount < 1) {
          return interaction.editReply({
            content: getTranslatedText(lang, 'autotimeout_command.INVALID_VIOLATIONS_COUNT'),
          });
        }
        setGuildAutotimeoutConfig(guildId, { violationsThreshold: violationsCount });
        return interaction.editReply({
          content: getTranslatedText(lang, 'autotimeout_command.VIOLATIONS_SET_SUCCESS', {
            count: violationsCount,
          }),
        });
      }

      case 'set_log_channel': {
        const channel = interaction.options.getChannel('channel');
        const channelId = channel ? channel.id : null;

        if (channel) {
          if (channel.type !== ChannelType.GuildText) {
            return interaction.editReply({
              content: getTranslatedText(lang, 'autotimeout_command.INVALID_LOG_CHANNEL_TYPE'),
            });
          }
          if (channel.guildId !== guildId) {
            return interaction.editReply({
              content: getTranslatedText(lang, 'autotimeout_command.INVALID_LOG_CHANNEL_GUILD'),
            });
          }
        }

        setGuildAutotimeoutConfig(guildId, { moderationLogChannelId: channelId });

        if (channelId) {
          return interaction.editReply({
            content: getTranslatedText(lang, 'autotimeout_command.LOG_CHANNEL_SET_SUCCESS', {
              channelMention: channel.toString(),
            }),
          });
        }
        return interaction.editReply({
          content: getTranslatedText(lang, 'autotimeout_command.LOG_CHANNEL_REMOVED_SUCCESS'),
        });
      }

      case 'status': {
        config = getGuildAutotimeoutConfig(guildId) ?? {};
        const enabledText = config.enabled
          ? getTranslatedText(lang, 'autotimeout_command.STATUS_ENABLED_TEXT')
          : getTranslatedText(lang, 'autotimeout_command.STATUS_DISABLED_TEXT');

        const durationText = config.durationMs
          ? ms(config.durationMs, { long: true })
          : getTranslatedText(lang, 'general.NOT_CONFIGURED');

        const violationsText =
          typeof config.violationsThreshold === 'number'
            ? String(config.violationsThreshold)
            : getTranslatedText(lang, 'general.NOT_CONFIGURED');

        const logChannelMention = config.moderationLogChannelId
          ? `<#${config.moderationLogChannelId}>`
          : getTranslatedText(lang, 'general.NOT_CONFIGURED');

        const statusEmbed = new EmbedBuilder()
          .setColor(config.enabled ? 0x57f287 : 0xed4245)
          .setTitle(getTranslatedText(lang, 'autotimeout_command.STATUS_TITLE'))
          .setDescription(
            getTranslatedText(lang, 'autotimeout_command.STATUS_DESCRIPTION', { status: enabledText }),
          )
          .addFields(
            {
              name: getTranslatedText(lang, 'autotimeout_command.STATUS_FIELD_DURATION'),
              value: durationText,
              inline: true,
            },
            {
              name: getTranslatedText(lang, 'autotimeout_command.STATUS_FIELD_VIOLATIONS'),
              value: violationsText,
              inline: true,
            },
            {
              name: getTranslatedText(lang, 'autotimeout_command.STATUS_FIELD_LOG_CHANNEL'),
              value: logChannelMention,
              inline: true,
            },
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [statusEmbed] });
      }
    }
  },
};