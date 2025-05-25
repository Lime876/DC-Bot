const fs = require('fs');
const path = require('path');

const logPath = path.join(__dirname, '../data/logchannels.json');

/**
 * Ruft die Logkanal-ID für eine Gilde ab.
 *
 * @param {string} guildId - Die ID der Gilde, für die der Logkanal abgerufen werden soll.
 * @returns {string|undefined} Die Kanal-ID des Logkanals oder undefined, wenn keiner gefunden wurde.
 */
function getLogChannelId(guildId) {
  try {
    if (!fs.existsSync(logPath)) {
      console.warn(`Log channel configuration file not found at ${logPath}`);
      return undefined;
    }
    const logData = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    const channelId = logData[guildId];
    if (!channelId) {
      console.warn(`No log channel configured for guild ID: ${guildId}`);
      return undefined;
    }
    return channelId;
  } catch (error) {
    console.error(`Error reading or parsing log channel configuration: ${error.message}`);
    return undefined;
  }
}

module.exports = { getLogChannelId };
