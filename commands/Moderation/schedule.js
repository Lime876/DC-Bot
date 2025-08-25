import { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';
import schedule from 'node-schedule';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('schedule')
  .setDescription('Plant eine Nachricht für später.')
  .setDescriptionLocalizations({
      de: getTranslatedText('de', 'schedule_command.DESCRIPTION'),
      'en-US': getTranslatedText('en', 'schedule_command.DESCRIPTION'),
  })
  .addStringOption(option =>
    option.setName('zeit')
      .setDescription('Zeit im Format YYYY-MM-DD HH:mm')
      .setDescriptionLocalizations({
          de: getTranslatedText('de', 'schedule_command.TIME_OPTION_DESCRIPTION'),
          'en-US': getTranslatedText('en', 'schedule_command.TIME_OPTION_DESCRIPTION'),
      })
      .setRequired(true))
  .addStringOption(option =>
    option.setName('nachricht')
      .setDescription('Die Nachricht, die gesendet werden soll')
      .setDescriptionLocalizations({
          de: getTranslatedText('de', 'schedule_command.MESSAGE_OPTION_DESCRIPTION'),
          'en-US': getTranslatedText('en', 'schedule_command.MESSAGE_OPTION_DESCRIPTION'),
      })
      .setRequired(true));

export const category = 'Moderation';

export async function execute(interaction) {
  const lang = await getGuildLanguage(interaction.guildId);

  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  const timeString = interaction.options.getString('zeit');
  const messageContent = interaction.options.getString('nachricht');
  const channel = interaction.channel;

  const date = new Date(timeString);
  if (isNaN(date.getTime())) {
    return interaction.editReply({ content: getTranslatedText(lang, 'schedule_command.INVALID_TIME_FORMAT') });
  }

  if (date.getTime() <= Date.now()) {
      return interaction.editReply({ content: getTranslatedText(lang, 'schedule_command.TIME_IN_PAST') });
  }

  const botPermissionsInChannel = channel.permissionsFor(interaction.client.user);
  if (!botPermissionsInChannel.has(PermissionFlagsBits.SendMessages)) {
      return interaction.editReply({ content: getTranslatedText(lang, 'schedule_command.BOT_MISSING_SEND_PERMISSIONS', { channelMention: channel.toString() }) });
  }

  try {
      schedule.scheduleJob(date, async () => {
          try {
              await channel.send(getTranslatedText(lang, 'schedule_command.SCHEDULED_MESSAGE_PREFIX', { message: messageContent }));
              logger.info(`[Schedule] Geplante Nachricht in Gilde ${interaction.guild.id} in Kanal ${channel.id} gesendet.`);
          } catch (error) {
              logger.error(`[Schedule] Fehler beim Senden der geplanten Nachricht in Kanal ${channel.id}:`, error);
          }
      });

      await interaction.editReply({ content: getTranslatedText(lang, 'schedule_command.SUCCESS_MESSAGE', { scheduledTime: date.toLocaleString(lang) }) });
  } catch (error) {
      logger.error(`[Schedule] Fehler beim Planen der Nachricht in Gilde ${interaction.guild.id}:`, error);
      await interaction.editReply({
          content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED_UNEXPECTED', { errorMessage: error.message }),
      });
  }
}
