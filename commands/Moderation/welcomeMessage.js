// commands/admin/welcome-message.js
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } from 'discord.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

const WELCOME_CONFIG_PATH = path.resolve('./data/welcomeMessages.json');
let welcomeConfigs = new Map();

async function loadWelcomeConfigs() {
  try {
    const data = await fs.readFile(WELCOME_CONFIG_PATH, 'utf8');
    welcomeConfigs = new Map(Object.entries(JSON.parse(data)));
    logger.debug('[WelcomeMessage] Willkommensnachricht-Konfiguration geladen.');
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.warn('[WelcomeMessage] welcomeMessages.json nicht gefunden, erstelle leere Konfiguration.');
      welcomeConfigs = new Map();
      await saveWelcomeConfigs();
    } else {
      logger.error('[WelcomeMessage] Fehler beim Laden der Willkommensnachricht-Konfiguration:', error);
      welcomeConfigs = new Map();
    }
  }
}

async function saveWelcomeConfigs(configs = welcomeConfigs) {
  try {
    await fs.writeFile(WELCOME_CONFIG_PATH, JSON.stringify(Object.fromEntries(configs), null, 2));
    logger.debug('[WelcomeMessage] Willkommensnachricht-Konfiguration gespeichert.');
  } catch (error) {
    logger.error('[WelcomeMessage] Fehler beim Speichern der Willkommensnachricht-Konfiguration:', error);
  }
}

loadWelcomeConfigs();

export const data = new SlashCommandBuilder()
  .setName('welcome-message')
  .setDescription('Konfiguriert eine automatische Willkommensnachricht für neue Mitglieder.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(subcommand =>
    subcommand
      .setName('set')
      .setDescription('Legt den Kanal und die Nachricht für die Willkommensnachricht fest.')
      .addChannelOption(option =>
        option.setName('channel')
          .setDescription('Der Kanal, in den die Willkommensnachricht gesendet werden soll.')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true))
      .addStringOption(option =>
        option.setName('message')
          .setDescription('Die Willkommensnachricht (verwende {user} für den Benutzernamen, {server} für den Servernamen).')
          .setRequired(true)))
  .addSubcommand(subcommand => subcommand.setName('disable').setDescription('Deaktiviert die automatische Willkommensnachricht.'))
  .addSubcommand(subcommand => subcommand.setName('show').setDescription('Zeigt die aktuelle Willkommensnachricht-Konfiguration an.'));

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guild.id;
  const lang = getGuildLanguage(guildId);
  const subcommand = interaction.options.getSubcommand();

  try {
    if (subcommand === 'set') {
      const channel = interaction.options.getChannel('channel');
      const messageContent = interaction.options.getString('message');
      if (!channel || channel.type !== ChannelType.GuildText) {
        return interaction.editReply({ content: getTranslatedText(lang, 'welcome_message_command.ERROR_INVALID_CHANNEL_TYPE'), ephemeral: true });
      }
      welcomeConfigs.set(guildId, { channelId: channel.id, messageContent });
      await saveWelcomeConfigs();
      await interaction.editReply({ content: getTranslatedText(lang, 'welcome_message_command.SET_SUCCESS', { channel: channel.toString() }) + '\n' + getTranslatedText(lang, 'welcome_message_command.SET_HINT'), ephemeral: true });
      logger.info(`[WelcomeMessage Command] Willkommensnachricht in Gilde ${interaction.guild.name} (${guildId}) auf Kanal ${channel.name} gesetzt. (PID: ${process.pid})`);

    } else if (subcommand === 'disable') {
      if (welcomeConfigs.has(guildId)) {
        welcomeConfigs.delete(guildId);
        await saveWelcomeConfigs();
        await interaction.editReply({ content: getTranslatedText(lang, 'welcome_message_command.DISABLED_SUCCESS') + '\n' + getTranslatedText(lang, 'welcome_message_command.DISABLE_HINT'), ephemeral: true });
        logger.info(`[WelcomeMessage Command] Willkommensnachricht in Gilde ${interaction.guild.name} (${guildId}) deaktiviert. (PID: ${process.pid})`);
      } else {
        await interaction.editReply({ content: getTranslatedText(lang, 'welcome_message_command.ALREADY_DISABLED'), ephemeral: true });
      }

    } else if (subcommand === 'show') {
      const currentConfig = welcomeConfigs.get(guildId);
      if (!currentConfig) {
        return interaction.editReply({ content: getTranslatedText(lang, 'welcome_message_command.SHOW_NO_CONFIG') + '\n' + getTranslatedText(lang, 'welcome_message_command.SHOW_HINT'), ephemeral: true });
      }
      const channel = interaction.guild.channels.cache.get(currentConfig.channelId);
      const channelMention = channel ? channel.toString() : getTranslatedText(lang, 'general.UNKNOWN');
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(getTranslatedText(lang, 'welcome_message_command.SHOW_CURRENT_CONFIG_TITLE'))
        .addFields(
          { name: getTranslatedText(lang, 'welcome_message_command.SHOW_CURRENT_CONFIG_CHANNEL'), value: channelMention, inline: true },
          { name: getTranslatedText(lang, 'welcome_message_command.SHOW_CURRENT_CONFIG_MESSAGE'), value: currentConfig.messageContent }
        )
        .setFooter({ text: getTranslatedText(lang, 'welcome_message_command.SHOW_FOOTER_HINT') })
        .setTimestamp();
      await interaction.editReply({ embeds: [embed], ephemeral: true });
      logger.info(`[WelcomeMessage Command] Willkommensnachricht-Konfiguration für Gilde ${interaction.guild.name} (${guildId}) angezeigt. (PID: ${process.pid})`);
    }

  } catch (error) {
    logger.error(`[WelcomeMessage Command] Fehler bei der Ausführung in Gilde ${guildId}:`, error);
    await interaction.editReply({ content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'), ephemeral: true });
  }
}
