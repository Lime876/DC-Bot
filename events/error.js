// events/error.js
// Entferne hier die Zeile: const { Events, MessageFlags } = require('discord.js');
// Da Events bereits in index.js deklariert wird.
const logger = require('../utils/logger'); // Importiere den Logger für Konsolenlogs

module.exports = {
    name: 'error', // Events.Error ist hier nicht nötig, da es direkt als String verwendet werden kann
    async execute(error, client) {
        logger.error(`❌ Unerwarteter Client-Fehler:`, error);

        // Für globale Client-Fehler ist es am besten, sie einfach zu loggen.
        // logEvent ist für gilden-spezifische Logs gedacht und benötigt eine guildId.
        // Wenn du einen globalen Fehler-Log-Kanal hast, müsstest du ihn hier manuell abrufen.
        // Beispiel:
        // const globalErrorLogChannelId = 'DEINE_GLOBAL_ERROR_CHANNEL_ID'; // Ersetze dies mit der tatsächlichen ID
        // const globalErrorLogChannel = client.channels.cache.get(globalErrorLogChannelId);
        // if (globalErrorLogChannel) {
        //     await globalErrorLogChannel.send(`Ein kritischer Bot-Fehler ist aufgetreten: \`\`\`${error.stack}\`\`\``).catch(err => logger.error("Konnte globalen Fehler nicht loggen:", err));
        // }
    }
};