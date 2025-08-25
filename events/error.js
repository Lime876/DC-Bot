// events/error.js
import logger from '../utils/logger.js';
import { getTranslatedText } from '../utils/languageUtils.js';
// import { EmbedBuilder } from 'discord.js'; // Nur einkommentieren, wenn du die globale Embed-Funktion nutzen möchtest

export default {
  name: 'error', // Discord.js Client-Fehler-Event
  async execute(error, client) {
    // Konsolen-Log
    logger.error('❌ Unerwarteter Client-Fehler:', error);

    // Optional: Globaler Fehler-Log-Kanal
    /*
    const GLOBAL_ERROR_LOG_CHANNEL_ID = 'DEINE_GLOBAL_ERROR_CHANNEL_ID';
    if (GLOBAL_ERROR_LOG_CHANNEL_ID) {
      const globalErrorLogChannel = client.channels.cache.get(GLOBAL_ERROR_LOG_CHANNEL_ID);
      if (globalErrorLogChannel?.isTextBased()) {
        try {
          const errorEmbed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle(getTranslatedText('en', 'global_error.TITLE'))
            .setDescription(
              getTranslatedText('en', 'global_error.DESCRIPTION', {
                errorMessage: error.message,
              })
            )
            .addFields({
              name: getTranslatedText('en', 'global_error.FIELD_STACK'),
              value: `\`\`\`${error.stack ? error.stack.substring(0, 1000) : 'N/A'}\`\`\``,
            })
            .setTimestamp();

          await globalErrorLogChannel.send({ embeds: [errorEmbed] });
        } catch (sendError) {
          logger.error('[Error Event] Konnte globalen Fehler nicht an Log-Kanal senden:', sendError);
        }
      }
    }
    */
    // Tipp: Hier minimal halten, um Fehler-Kaskaden zu vermeiden
  },
};