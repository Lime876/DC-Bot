// commands/admin/jtc-setup.js — ESM-Version
import { SlashCommandBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import { getJTCConfigForGuild, setJTCConfigForGuild, deleteJTCConfigForGuild } from '../../utils/jtcConfig.js';
import logger from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('jtc-setup')
    .setDescription('Sets up the Join to Create (JTC) voice channel system.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set')
        .setDescription('Sets or updates the JTC voice channel.')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('The voice channel users join to create a new channel.')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildVoice),
        )
        .addChannelOption((option) =>
          option
            .setName('category')
            .setDescription('The category where temporary voice channels will be created (optional).')
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildCategory),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('disable').setDescription('Disables the JTC system for this server.'),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('status').setDescription('Shows the current JTC setup for this server.'),
    ),

  category: 'Admin',

  async execute(interaction) {
    try {
      const guild = interaction.guild;
      if (!guild) {
        return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      }

      const lang = await getGuildLanguage(guild.id);
      const subcommand = interaction.options.getSubcommand();

      // Helper: human readable permission names (attempt localized keys, fallback to constant name)
      const PERMISSION_KEY_MAP = {
        [PermissionFlagsBits.ManageChannels]: 'permissions.MANAGE_CHANNELS',
        [PermissionFlagsBits.MoveMembers]: 'permissions.MOVE_MEMBERS',
        [PermissionFlagsBits.ViewChannel]: 'permissions.VIEW_CHANNEL',
        [PermissionFlagsBits.Connect]: 'permissions.CONNECT',
      };

      if (subcommand === 'set') {
        const jtcChannel = interaction.options.getChannel('channel');
        const jtcCategory = interaction.options.getChannel('category');

        // Basic validation
        if (!jtcChannel || jtcChannel.type !== ChannelType.GuildVoice) {
          return interaction.reply({ content: getTranslatedText(lang, 'jtc_command.invalid_channel_type'), ephemeral: true });
        }

        if (jtcCategory && jtcCategory.guildId !== guild.id) {
          return interaction.reply({ content: getTranslatedText(lang, 'jtc_command.invalid_category_type'), ephemeral: true });
        }

        // Ensure we have the bot guild member object
        let botMember = guild.members.me;
        if (!botMember) {
          try {
            botMember = await guild.members.fetch(interaction.client.user.id);
          } catch (err) {
            logger.error('[JTC Setup] Failed to fetch bot member:', err);
            return interaction.reply({ content: getTranslatedText(lang, 'jtc_command.bot_fetch_failed'), ephemeral: true });
          }
        }

        // Check required guild-level permissions
        const requiredGuildPermissions = [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers];
        const missingGuildPerms = requiredGuildPermissions.filter((p) => !botMember.permissions.has(p));

        // Check channel-level (jtcChannel) perms for the bot
        const channelPerms = jtcChannel.permissionsFor(botMember);
        const missingChannelPerms = [];
        if (!channelPerms || !channelPerms.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect])) {
          if (!channelPerms || !channelPerms.has(PermissionFlagsBits.ViewChannel)) missingChannelPerms.push(PermissionFlagsBits.ViewChannel);
          if (!channelPerms || !channelPerms.has(PermissionFlagsBits.Connect)) missingChannelPerms.push(PermissionFlagsBits.Connect);
        }

        if (missingGuildPerms.length > 0 || missingChannelPerms.length > 0) {
          const allMissing = [...missingGuildPerms, ...missingChannelPerms];
          const readable = allMissing
            .map((p) => {
              const key = PERMISSION_KEY_MAP[p];
              if (key) return getTranslatedText(lang, key) || key.split('.').pop();
              return String(p);
            })
            .join(', ');

          return interaction.reply({
            content: getTranslatedText(lang, 'jtc_command.bot_permission_error', { permissions: readable }),
            ephemeral: true,
          });
        }

        // Save the config (setJTCConfigForGuild is async in utils)
        try {
          await setJTCConfigForGuild(guild.id, jtcChannel.id, jtcCategory ? jtcCategory.id : null);
        } catch (err) {
          logger.error(`[JTC Setup] Failed to save config for guild ${guild.id}:`, err);
          return interaction.reply({ content: getTranslatedText(lang, 'jtc_command.save_failed'), ephemeral: true });
        }

        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle(getTranslatedText(lang, 'jtc_command.setup_success_title'))
          .setDescription(
            getTranslatedText(lang, 'jtc_command.setup_success_description', {
              channel: `<#${jtcChannel.id}>`,
              category: jtcCategory ? `<#${jtcCategory.id}>` : getTranslatedText(lang, 'jtc_command.no_category_specified'),
            }),
          )
          .setFooter({ text: getTranslatedText(lang, 'jtc_command.setup_success_footer') });

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (subcommand === 'disable') {
        try {
          const deleted = await deleteJTCConfigForGuild(guild.id);
          const embed = new EmbedBuilder();
          if (deleted) {
            embed
              .setColor(0xff0000)
              .setTitle(getTranslatedText(lang, 'jtc_command.disable_success_title'))
              .setDescription(getTranslatedText(lang, 'jtc_command.disable_success_description'));
          } else {
            embed
              .setColor(0xffa500)
              .setTitle(getTranslatedText(lang, 'jtc_command.disable_not_setup_title'))
              .setDescription(getTranslatedText(lang, 'jtc_command.disable_not_setup_description'));
          }
          return interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (err) {
          logger.error(`[JTC Setup] Failed to delete config for guild ${guild.id}:`, err);
          return interaction.reply({ content: getTranslatedText(lang, 'jtc_command.disable_failed'), ephemeral: true });
        }
      }

      if (subcommand === 'status') {
        const currentConfig = getJTCConfigForGuild(guild.id);

        const embed = new EmbedBuilder().setColor(0x0099ff).setTitle(getTranslatedText(lang, 'jtc_command.status_title'));

        if (currentConfig && currentConfig.channelId) {
          const cfgChannel = await guild.channels.fetch(currentConfig.channelId).catch(() => null);
          const cfgCategory = currentConfig.categoryId ? await guild.channels.fetch(currentConfig.categoryId).catch(() => null) : null;

          embed.setDescription(
            getTranslatedText(lang, 'jtc_command.status_active_description', {
              channel: cfgChannel ? `<#${cfgChannel.id}>` : getTranslatedText(lang, 'jtc_command.channel_not_found'),
              category: cfgCategory ? `<#${cfgCategory.id}>` : getTranslatedText(lang, 'jtc_command.no_category_specified'),
            }),
          );
        } else {
          embed.setDescription(getTranslatedText(lang, 'jtc_command.status_inactive_description'));
        }

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // Fallback: unknown subcommand
      return interaction.reply({ content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'), ephemeral: true });
    } catch (error) {
      logger.error('[JTC Setup] Unexpected error in command execution:', error);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: 'An unexpected error occurred.', ephemeral: true });
        } else {
          await interaction.followUp({ content: 'An unexpected error occurred.', ephemeral: true });
        }
      } catch (err) {
        logger.error('[JTC Setup] Failed to send error message to interaction:', err);
      }
    }
  },
};