// commands/invitetracker.js (ESM-Version)
// Invite Tracker - robustere Dateioperationen, saubere Iteration über Invite-Daten

import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType
} from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

// __dirname für ESM definieren
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inviteDataPath = path.join(__dirname, '../../data/inviteData.json');
const trackerConfigPath = path.join(__dirname, '../../data/trackerConfig.json');

// --- Hilfsfunktionen für Dateioperationen (synchron, aber mit Fehlerbehandlung) ---
function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (err) {
    logger.error(`[InviteTracker] Fehler beim Laden oder Parsen von ${filePath}:`, err);
    // Backup defekter Datei
    try {
      const bak = `${filePath}.bak-${Date.now()}`;
      if (fs.existsSync(filePath)) fs.renameSync(filePath, bak);
      logger.warn(`[InviteTracker] Defekte Datei gesichert: ${bak}`);
    } catch (bakErr) {
      logger.error(`[InviteTracker] Backup der defekten Datei fehlgeschlagen:`, bakErr);
    }
    return {};
  }
}

function saveJsonSafe(filePath, data) {
  try {
    ensureDir(filePath);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    logger.error(`[InviteTracker] Fehler beim Schreiben in ${filePath}:`, err);
  }
}

// --- Spezifische Loader / Saver ---
function loadInviteData() {
  return loadJsonSafe(inviteDataPath);
}
function saveInviteData(data) {
  saveJsonSafe(inviteDataPath, data);
}

function loadTrackerConfig() {
  return loadJsonSafe(trackerConfigPath);
}
function saveTrackerConfig(data) {
  saveJsonSafe(trackerConfigPath, data);
}

export default {
  data: new SlashCommandBuilder()
    .setName('invitetracker')
    .setDescription('Manages the Invite Tracker or displays invite statistics.')
    .setDescriptionLocalizations({
      de: getTranslatedText('de', 'invitetracker_command.DESCRIPTION'),
      'en-US': getTranslatedText('en', 'invitetracker_command.DESCRIPTION'),
    })
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub => sub
      .setName('status')
      .setDescription('Displays the current status of the Invite Tracker.')
      .setDescriptionLocalizations({
        de: getTranslatedText('de', 'invitetracker_command.STATUS_SUBCOMMAND_DESCRIPTION'),
        'en-US': getTranslatedText('en', 'invitetracker_command.STATUS_SUBCOMMAND_DESCRIPTION'),
      }))
    .addSubcommand(sub => sub
      .setName('on')
      .setDescription('Activates the Invite Tracker for this server.')
      .setDescriptionLocalizations({
        de: getTranslatedText('de', 'invitetracker_command.ON_SUBCOMMAND_DESCRIPTION'),
        'en-US': getTranslatedText('en', 'invitetracker_command.ON_SUBCOMMAND_DESCRIPTION'),
      })
      .addChannelOption(opt => opt
        .setName('log_channel')
        .setDescription('Channel to send join logs to.')
        .setDescriptionLocalizations({
          de: getTranslatedText('de', 'invitetracker_command.LOG_CHANNEL_OPTION_DESCRIPTION'),
          'en-US': getTranslatedText('en', 'invitetracker_command.LOG_CHANNEL_OPTION_DESCRIPTION'),
        })
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)))
    .addSubcommand(sub => sub
      .setName('off')
      .setDescription('Deactivates the Invite Tracker for this server.')
      .setDescriptionLocalizations({
        de: getTranslatedText('de', 'invitetracker_command.OFF_SUBCOMMAND_DESCRIPTION'),
        'en-US': getTranslatedText('en', 'invitetracker_command.OFF_SUBCOMMAND_DESCRIPTION'),
      }))
    .addSubcommand(sub => sub
      .setName('my_invites')
      .setDescription('Shows how many people you have invited.')
      .setDescriptionLocalizations({
        de: getTranslatedText('de', 'invitetracker_command.MY_INVITES_SUBCOMMAND_DESCRIPTION'),
        'en-US': getTranslatedText('en', 'invitetracker_command.MY_INVITES_SUBCOMMAND_DESCRIPTION'),
      }))
    .addSubcommand(sub => sub
      .setName('user_invites')
      .setDescription('Shows how many people a specific user has invited.')
      .setDescriptionLocalizations({
        de: getTranslatedText('de', 'invitetracker_command.USER_INVITES_SUBCOMMAND_DESCRIPTION'),
        'en-US': getTranslatedText('en', 'invitetracker_command.USER_INVITES_SUBCOMMAND_DESCRIPTION'),
      })
      .addUserOption(opt => opt
        .setName('user')
        .setDescription('The user whose invite statistics to display.')
        .setDescriptionLocalizations({
          de: getTranslatedText('de', 'invitetracker_command.USER_OPTION_DESCRIPTION'),
          'en-US': getTranslatedText('en', 'invitetracker_command.USER_OPTION_DESCRIPTION'),
        })
        .setRequired(true)))
    .addSubcommand(sub => sub
      .setName('leaderboard')
      .setDescription('Displays the top inviters on the server.')
      .setDescriptionLocalizations({
        de: getTranslatedText('de', 'invitetracker_command.LEADERBOARD_SUBCOMMAND_DESCRIPTION'),
        'en-US': getTranslatedText('en', 'invitetracker_command.LEADERBOARD_SUBCOMMAND_DESCRIPTION'),
      })),

  category: 'Admin',

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const lang = await getGuildLanguage(guildId);

    const trackerConfig = loadTrackerConfig();
    const inviteData = loadInviteData();

    if (!trackerConfig[guildId]) {
      trackerConfig[guildId] = { enabled: false, channelId: null };
      saveTrackerConfig(trackerConfig);
    }

    const isEnabled = !!trackerConfig[guildId].enabled;

    if (['on', 'off', 'leaderboard'].includes(subcommand)) {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
          content: getTranslatedText(lang, 'permissions.MISSING_PERMISSION_SINGULAR', {
            permission: getTranslatedText(lang, 'permissions.MANAGE_GUILD')
          }),
          ephemeral: true
        });
      }
    }

    // --- STATUS ---
    if (subcommand === 'status') {
      const statusEmbed = new EmbedBuilder()
        .setColor(isEnabled ? 0x00FF00 : 0xFF0000)
        .setTitle(getTranslatedText(lang, 'invitetracker_command.STATUS_TITLE'))
        .setDescription(getTranslatedText(lang, 'invitetracker_command.STATUS_DESCRIPTION', {
          status: isEnabled
            ? getTranslatedText(lang, 'invitetracker_command.STATUS_ENABLED')
            : getTranslatedText(lang, 'invitetracker_command.STATUS_DISABLED')
        }))
        .setTimestamp();

      if (isEnabled && trackerConfig[guildId].channelId) {
        statusEmbed.addFields({
          name: getTranslatedText(lang, 'invitetracker_command.STATUS_FIELD_LOG_CHANNEL'),
          value: `<#${trackerConfig[guildId].channelId}>`,
          inline: true
        });
      }

      return interaction.reply({ embeds: [statusEmbed], ephemeral: true });
    }

    // --- ON ---
    if (subcommand === 'on') {
      if (isEnabled) {
        return interaction.reply({
          content: getTranslatedText(lang, 'invitetracker_command.ALREADY_ENABLED'),
          ephemeral: true
        });
      }

      const logChannel = interaction.options.getChannel('log_channel');
      if (!logChannel || logChannel.type !== ChannelType.GuildText) {
        return interaction.reply({
          content: getTranslatedText(lang, 'invitetracker_command.INVALID_LOG_CHANNEL'),
          ephemeral: true
        });
      }

      trackerConfig[guildId].enabled = true;
      trackerConfig[guildId].channelId = logChannel.id;
      saveTrackerConfig(trackerConfig);

      try {
        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageGuild)) {
          logger.warn(`[Invite Tracker] Bot lacks ManageGuild permission in guild ${guildId}. Cannot fetch invites.`);
          return interaction.reply({
            content: getTranslatedText(lang, 'invitetracker_command.ENABLE_FAIL_PERMS'),
            ephemeral: true
          });
        }

        await interaction.guild.invites.fetch();
        logger.info(`[Invite Tracker] Invites für Server "${interaction.guild.name}" (${guildId}) neu gecacht nach Aktivierung.`);
      } catch (err) {
        logger.error(`[Invite Tracker] Konnte Invites für Server ${guildId} nicht cachen:`, err);
        return interaction.reply({
          content: getTranslatedText(lang, 'invitetracker_command.ENABLE_FAIL_PERMS'),
          ephemeral: true
        });
      }

      const enableEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle(getTranslatedText(lang, 'invitetracker_command.ENABLE_SUCCESS_TITLE'))
        .setDescription(getTranslatedText(lang, 'invitetracker_command.ENABLE_SUCCESS_DESCRIPTION', {
          logChannel: logChannel.toString()
        }))
        .setTimestamp();

      return interaction.reply({ embeds: [enableEmbed], ephemeral: true });
    }

    // --- OFF ---
    if (subcommand === 'off') {
      if (!isEnabled) {
        return interaction.reply({
          content: getTranslatedText(lang, 'invitetracker_command.ALREADY_DISABLED'),
          ephemeral: true
        });
      }

      trackerConfig[guildId].enabled = false;
      trackerConfig[guildId].channelId = null;
      saveTrackerConfig(trackerConfig);

      const disableEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle(getTranslatedText(lang, 'invitetracker_command.DISABLE_SUCCESS_TITLE'))
        .setDescription(getTranslatedText(lang, 'invitetracker_command.DISABLE_SUCCESS_DESCRIPTION'))
        .setTimestamp();

      return interaction.reply({ embeds: [disableEmbed], ephemeral: true });
    }

    // --- MY / USER INVITES ---
    if (subcommand === 'my_invites' || subcommand === 'user_invites') {
      if (!isEnabled) {
        return interaction.reply({
          content: getTranslatedText(lang, 'invitetracker_command.NOT_ENABLED'),
          ephemeral: true
        });
      }

      const targetUser =
        subcommand === 'my_invites'
          ? interaction.user
          : interaction.options.getUser('user');

      if (!targetUser) {
        return interaction.reply({
          content: getTranslatedText(lang, 'invitetracker_command.USER_NOT_FOUND'),
          ephemeral: true
        });
      }

      const guildInvites = inviteData[guildId] || {};
      const entries = Object.entries(guildInvites);
      const userInviteEntries = entries.filter(
        ([, inv]) => inv.inviterId === targetUser.id
      );

      let totalUses = 0;
      let activeInvitesCount = 0;

      for (const [, inv] of userInviteEntries) {
        totalUses += Number(inv.uses || 0);
        const maxUses = Number(inv.maxUses || 0);
        const expiresAt = inv.expiresAt ? Number(inv.expiresAt) : null;

        const notExhausted = maxUses === 0 || inv.uses < maxUses;
        const notExpired = !expiresAt || expiresAt > Date.now();
        if (notExhausted && notExpired) activeInvitesCount++;
      }

      const userEmbed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(getTranslatedText(lang, 'invitetracker_command.YOUR_INVITES_TITLE', {
          userTag: targetUser.tag
        }))
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(
          {
            name: getTranslatedText(lang, 'invitetracker_command.FIELD_TOTAL_INVITES'),
            value: `${totalUses}`,
            inline: true
          },
          {
            name: getTranslatedText(lang, 'invitetracker_command.FIELD_ACTIVE_INVITES'),
            value: `${activeInvitesCount}`,
            inline: true
          }
        )
        .setTimestamp();

      if (userInviteEntries.length > 0) {
        const inviteCodesList = userInviteEntries
          .map(
            ([code, inv]) =>
              `\`${code}\` (${inv.uses || 0} ${getTranslatedText(lang, 'invitetracker_command.INVITE_USES')})`
          )
          .join(', ');
        userEmbed.addFields({
          name: getTranslatedText(lang, 'invitetracker_command.FIELD_YOUR_INVITES'),
          value:
            inviteCodesList.length > 1024
              ? inviteCodesList.substring(0, 1020) + '...'
              : inviteCodesList,
          inline: false
        });
      } else {
        userEmbed.addFields({
          name: getTranslatedText(lang, 'invitetracker_command.FIELD_YOUR_INVITES'),
          value: getTranslatedText(lang, 'invitetracker_command.NO_ACTIVE_INVITES'),
          inline: false
        });
      }

      return interaction.reply({ embeds: [userEmbed], ephemeral: true });
    }

    // --- LEADERBOARD ---
    if (subcommand === 'leaderboard') {
      if (!isEnabled) {
        return interaction.reply({
          content: getTranslatedText(lang, 'invitetracker_command.NOT_ENABLED'),
          ephemeral: true
        });
      }

      const guildInvites = inviteData[guildId] || {};
      if (Object.keys(guildInvites).length === 0) {
        return interaction.reply({
          content: getTranslatedText(lang, 'invitetracker_command.NO_INVITE_DATA_LEADERBOARD'),
          ephemeral: true
        });
      }

      const inviterStats = {};
      for (const [, inv] of Object.entries(guildInvites)) {
        if (inv.inviterId) {
          inviterStats[inv.inviterId] =
            (inviterStats[inv.inviterId] || 0) + Number(inv.uses || 0);
        }
      }

      const sorted = Object.entries(inviterStats).sort(([, a], [, b]) => b - a);

      const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle(getTranslatedText(lang, 'invitetracker_command.LEADERBOARD_TITLE'))
        .setDescription(getTranslatedText(lang, 'invitetracker_command.LEADERBOARD_DESCRIPTION'))
        .setTimestamp();

      let rank = 1;
      for (const [inviterId, uses] of sorted.slice(0, 10)) {
        const user = await interaction.client.users.fetch(inviterId).catch(() => null);
        const display = user ? `${rank}. ${user.tag}` : `${rank}. <@${inviterId}>`;
        embed.addFields({
          name: display,
          value: getTranslatedText(lang, 'invitetracker_command.LEADERBOARD_INVITES_COUNT', {
            uses
          }),
          inline: false
        });
        rank++;
      }

      if (!embed.data.fields || embed.data.fields.length === 0) {
        embed.setDescription(getTranslatedText(lang, 'invitetracker_command.NO_STATS_AVAILABLE'));
      }

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    return interaction.reply({
      content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'),
      ephemeral: true
    });
  }
};
