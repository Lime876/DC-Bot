const { Events, EmbedBuilder } = require('discord.js'); // EmbedBuilder hinzufügen, falls noch nicht da
const { sendLog } = require('../utils/logger.js'); // Importiere die sendLog Funktion (nur für Datei/Konsole)
const { getLogChannelId } = require('../utils/config.js'); // Importiere die getLogChannelId Funktion

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        try {
            const user = newState.member.user;
            const guild = newState.guild;

            // Ignoriere Bots
            if (user.bot) return;

            // Benutzer ist einem Sprachkanal beigetreten
            if (!oldState.channelId && newState.channelId) {
                const newChannel = newState.channel;
                // Logge in Datei/Konsole
                sendLog(`🔊 Benutzer ${user.tag} (${user.id}) ist dem Sprachkanal "${newChannel.name}" (${newChannel.id}) auf Server "${guild.name}" (${guild.id}) beigetreten.`, 'INFO');

                // Sende eine Nachricht an den konfigurierten Log-Kanal im Server
                const logChannelId = getLogChannelId(guild.id);
                if (logChannelId) {
                    const logChannel = guild.channels.cache.get(logChannelId);
                    if (logChannel) {
                        const embed = new EmbedBuilder() // EmbedBuilder verwenden
                            .setColor(0x57F287) // Grün
                            .setAuthor({
                                name: `${user.tag} ist beigetreten`,
                                icon_url: user.displayAvatarURL(),
                            })
                            .setDescription(`🔊 **${user.tag}** ist dem Sprachkanal **${newChannel.name}** beigetreten.`)
                            .setTimestamp()
                            .setFooter({
                                text: `Benutzer ID: ${user.id}`,
                            });
                        logChannel.send({ embeds: [embed] }).catch(error => {
                            // Logge Fehler beim Senden des Embeds
                            sendLog(`Fehler beim Senden des Sprachkanal-Beitritts-Logs an Log-Kanal ${logChannelId} auf Server "${guild.name}": ${error.message}`, 'ERROR');
                            console.error(`Fehler beim Senden des Sprachkanal-Beitritts-Logs an Kanal ${logChannelId}:`, error); // Behalte console.error
                        });
                    } else {
                         // Logge, wenn der konfigurierte Kanal nicht gefunden wurde
                         sendLog(`Konfigurierter Log-Kanal (${logChannelId}) für Server "${guild.name}" (${guild.id}) nicht gefunden (Sprachkanal-Beitritt).`, 'WARN');
                    }
                } else {
                    // Logge, wenn kein Log-Kanal konfiguriert ist
                    sendLog(`Kein Log-Kanal für Server "${guild.name}" (${guild.id}) konfiguriert (Sprachkanal-Beitritt).`, 'WARN');
                }

            }
            // Benutzer hat einen Sprachkanal verlassen
            else if (oldState.channelId && !newState.channelId) {
                const oldChannel = oldState.channel;
                 // Logge in Datei/Konsole
                 sendLog(`🔇 Benutzer ${user.tag} (${user.id}) hat den Sprachkanal "${oldChannel.name}" (${oldChannel.id}) auf Server "${guild.name}" (${guild.id}) verlassen.`, 'INFO');

                 // Sende eine Nachricht an den konfigurierten Log-Kanal im Server
                const logChannelId = getLogChannelId(guild.id);
                if (logChannelId) {
                    const logChannel = guild.channels.cache.get(logChannelId);
                    if (logChannel) {
                        const embed = new EmbedBuilder() // EmbedBuilder verwenden
                            .setColor(0xED4245) // Rot
                            .setAuthor({
                                name: `${user.tag} hat verlassen`,
                                icon_url: user.displayAvatarURL(),
                            })
                            .setDescription(`🔇 **${user.tag}** hat den Sprachkanal **${oldChannel.name}** verlassen.`)
                            .setTimestamp()
                            .setFooter({
                                text: `Benutzer ID: ${user.id}`,
                            });
                        logChannel.send({ embeds: [embed] }).catch(error => {
                             // Logge Fehler beim Senden des Embeds
                             sendLog(`Fehler beim Senden des Sprachkanal-Verlassen-Logs an Log-Kanal ${logChannelId} auf Server "${guild.name}": ${error.message}`, 'ERROR');
                             console.error(`Fehler beim Senden des Sprachkanal-Verlassen-Logs an Kanal ${logChannelId}:`, error); // Behalte console.error
                        });
                    } else {
                         // Logge, wenn der konfigurierte Kanal nicht gefunden wurde
                         sendLog(`Konfigurierter Log-Kanal (${logChannelId}) für Server "${guild.name}" (${guild.id}) nicht gefunden (Sprachkanal verlassen).`, 'WARN');
                    }
                } else {
                    // Logge, wenn kein Log-Kanal konfiguriert ist
                    sendLog(`Kein Log-Kanal für Server "${guild.name}" (${guild.id}) konfiguriert (Sprachkanal verlassen).`, 'WARN');
                }
            }
            // Benutzer hat den Sprachkanal gewechselt
            else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
                const oldChannel = oldState.channel;
                const newChannel = newState.channel;
                // Logge in Datei/Konsole
                sendLog(`🔄 Benutzer ${user.tag} (${user.id}) hat den Sprachkanal von "${oldChannel.name}" (${oldChannel.id}) zu "${newChannel.name}" (${newChannel.id}) auf Server "${guild.name}" (${guild.id}) gewechselt.`, 'INFO');

                 // Sende eine Nachricht an den konfigurierten Log-Kanal im Server
                const logChannelId = getLogChannelId(guild.id);
                if (logChannelId) {
                    const logChannel = guild.channels.cache.get(logChannelId);
                    if (logChannel) {
                        const embed = new EmbedBuilder() // EmbedBuilder verwenden
                            .setColor(0xFEE75C) // Gelb
                            .setAuthor({
                                name: `${user.tag} hat den Kanal gewechselt`,
                                icon_url: user.displayAvatarURL(),
                            })
                            .setDescription(`🔄 **${user.tag}** hat den Sprachkanal von **${oldChannel.name}** zu **${newChannel.name}** gewechselt.`)
                            .setTimestamp()
                            .setFooter({
                                text: `Benutzer ID: ${user.id}`,
                            });
                        logChannel.send({ embeds: [embed] }).catch(error => {
                             // Logge Fehler beim Senden des Embeds
                             sendLog(`Fehler beim Senden des Sprachkanal-Wechsel-Logs an Log-Kanal ${logChannelId} auf Server "${guild.name}": ${error.message}`, 'ERROR');
                             console.error(`Fehler beim Senden des Sprachkanal-Wechsel-Logs an Kanal ${logChannelId}:`, error); // Behalte console.error
                        });
                    } else {
                         // Logge, wenn der konfigurierte Kanal nicht gefunden wurde
                         sendLog(`Konfigurierter Log-Kanal (${logChannelId}) für Server "${guild.name}" (${guild.id}) nicht gefunden (Sprachkanal gewechselt).`, 'WARN');
                    }
                } else {
                    // Logge, wenn kein Log-Kanal konfiguriert ist
                    sendLog(`Kein Log-Kanal für Server "${guild.name}" (${guild.id}) konfiguriert (Sprachkanal gewechselt).`, 'WARN');
                }
            }
            // Hier könnten weitere Zustandsänderungen geloggt werden (z.B. Mute/Deafen)
            // else if (oldState.selfMute !== newState.selfMute) { /* ... */ }

        } catch (error) {
            // Logge Fehler im Event-Handler
            const guildName = newState.guild?.name || 'DM';
            const userId = newState.member?.user.id || 'Unbekannte ID';
            const userTag = newState.member?.user.tag || 'Unbekannter Benutzer';
            sendLog(`Fehler im voiceStateUpdate Event für Benutzer ${userTag} (${userId}) auf Server "${guildName}": ${error.message}`, 'ERROR');
            console.error('Error in voiceStateUpdate event:', error); // Behalte console.error
        }
    },
};
