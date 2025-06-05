const { Events } = require('discord.js');
const { sendLog } = require('../utils/logger.js');

module.exports = {
  name: Events.Error,
  execute(error, client) {
    console.error('❌ Unerwarteter Client-Fehler:', error);
    sendLog(client, `❌ Unerwarteter Client-Fehler: ${error.message}`);
  },
};
