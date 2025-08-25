// commands/utility/ping.js
import { SlashCommandBuilder } from 'discord.js';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Zeigt die Latenz zum Bot und zur API')
    .setDescriptionLocalizations({
      de: getTranslatedText('de', 'ping_command.DESCRIPTION'),
      'en-US': getTranslatedText('en', 'ping_command.DESCRIPTION'),
    }),

  category: 'Utility',

  async execute(interaction) {
    // Defer the reply, da die Operationen etwas dauern können
    await interaction.deferReply({ ephemeral: true });

    const lang = await getGuildLanguage(interaction.guildId);

    try {
      const sent = await interaction.editReply({
        content: getTranslatedText(lang, 'ping_command.CALCULATING_PING'),
        fetchReply: true
      });

      const botPing = sent.createdTimestamp - interaction.createdTimestamp;
      const apiPing = interaction.client.ws.ping;

      await interaction.editReply(
        getTranslatedText(lang, 'ping_command.PONG_MESSAGE', { botPing, apiPing })
      );

      logger.info(
        `[Ping Command] Ping-Befehl in Gilde ${interaction.guild.name} (${interaction.guild.id}) ausgeführt. ` +
        `Bot-Latenz: ${botPing}ms, API-Latenz: ${apiPing}ms. (PID: ${process.pid})`
      );
    } catch (error) {
      logger.error(
        `[Ping Command] Fehler beim Ausführen des Ping-Befehls in Gilde ${interaction.guild.id}:`,
        error
      );
      await interaction.editReply({
        content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'),
        ephemeral: true
      });
    }
  },
};