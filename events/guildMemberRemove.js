const { Events, EmbedBuilder } = require('discord.js');
const { getLogChannelId } = require('../utils/config.js'); // Geänderter Pfad
const { sendLog } = require('../utils/logger.js'); // Geänderter Pfad, Annahme: sendLog existiert
const fs = require('fs');
const path = require('path');
const { getGuildLanguage, getTranslatedText } = require('../utils/languageUtils');

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member) {
    try {
      const logChannelId = getLogChannelId(member.guild.id);
      if (!logChannelId) return;

      const logChannel = member.guild.channels.cache.get(logChannelId);
      if (!logChannel) return;

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setAuthor({
          name: `${member.user.tag} hat den Server verlassen`,
          iconURL: member.user.displayAvatarURL(),
        })
        .setDescription(`Auf Wiedersehen!`)
        .setTimestamp();

      await logChannel.send({ embeds: [embed] }).catch(error => {
        console.error('Failed to send leave log message:', error);
      });

      // === Rejoin Roles ===
      const rolesPath = path.join(__dirname, '../data/rejoinRoles.json');
      let allRoles = {};

      try {
        if (fs.existsSync(rolesPath)) {
          const rolesData = fs.readFileSync(rolesPath, 'utf8');
          allRoles = JSON.parse(rolesData);
        }
      } catch (readError) {
        console.error('Failed to read rejoinRoles.json:', readError);
        // Sollte der Event fortgesetzt werden, wenn das Lesen der Datei fehlschlägt?
        // Hier könnte eine Entscheidung getroffen werden, ob der Event abgebrochen werden soll.
        // Fürs Erste lasse ich es fortfahren, aber das sollte überprüft werden.
      }

      allRoles[member.id] = {
        guildId: member.guild.id,
        roles: member.roles.cache.filter(r => r.id !== member.guild.id).map(r => r.id),
      };

      try {
        fs.writeFileSync(rolesPath, JSON.stringify(allRoles, null, 2), 'utf8');
      } catch (writeError) {
        console.error('Failed to write to rejoinRoles.json:', writeError);
        // Hier sollte entschieden werden, ob der Event abgebrochen werden soll.
        // Fürs Erste lasse ich es fortfahren, aber das sollte überprüft werden.
      }
      //await sendLog(member.client, `➖ **${member.user.tag}** hat den Server verlassen.`); // Client übergeben
        if (typeof sendLog === 'function') {
            await sendLog(member.client, `➖ **${member.user.tag}** hat den Server verlassen.`); // Client übergeben
        } else {
            console.warn('sendLog is not a function.  Logging to console instead.');
            console.log(`➖ **${member.user.tag}** hat den Server verlassen.`);
        }

    } catch (error) {
      console.error('Error in guildMemberRemove event:', error);
    }
  },
};
