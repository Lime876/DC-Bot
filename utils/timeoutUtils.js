// utils/timeoutUtils.js
const { PermissionsBitField, EmbedBuilder, MessageFlags } = require('discord.js');
const { getGuildLanguage, getTranslatedText } = require('./languageUtils');
const { getGuildAutotimeoutConfig } = require('./autotimeoutConfig');
const ms = require('ms');
const log = require('./logUtils');

/**
 * Versetzt ein Gildenmitglied in Timeout.
 * @param {GuildMember} member - Das Gildenmitglied, das in Timeout versetzt werden soll.
 * @param {number} durationMs - Die Dauer des Timeouts in Millisekunden.
 * @param {string} reason - Der Grund für den Timeout.
 * @param {TextChannel} [channelForUserFeedback=null] - Ein optionaler Kanal, in den eine *ephemere* Nutzerbenachrichtigung gesendet werden kann.
 * @returns {Promise<boolean>} True, wenn der Timeout erfolgreich angewendet wurde, sonst false.
 */
async function applyTimeout(member, durationMs, reason, channelForUserFeedback = null) {
    const guild = member.guild;
    const lang = getGuildLanguage(guild.id);
    const autotimeoutConfig = getGuildAutotimeoutConfig(guild.id);

    // Bestimme den Log-Kanal
    let logChannel = null;
    if (autotimeoutConfig.moderationLogChannelId) {
        try {
            logChannel = await guild.channels.fetch(autotimeoutConfig.moderationLogChannelId);
            if (!logChannel || !logChannel.isTextBased()) {
                log.warn(`[TimeoutUtils] Konfigurierter Log-Kanal (${autotimeoutConfig.moderationLogChannelId}) für Autotimeout ist kein Textkanal oder nicht gefunden.`);
                logChannel = null;
            }
        } catch (e) {
            log.error(`[TimeoutUtils] Fehler beim Abrufen des Autotimeout-Log-Kanals (${autotimeoutConfig.moderationLogChannelId}):`, e);
            logChannel = null;
        }
    }

    let targetMember;
    try {
        // Force refresh the member to get the latest data
        targetMember = await guild.members.fetch({ user: member.id, force: true });
    } catch (fetchError) {
        const errorMessage = getTranslatedText(lang, 'autotimeout.TIMEOUT_FAILED_MEMBER_FETCH', { userTag: member.user.tag, errorMessage: fetchError.message });
        log.error(`[TimeoutUtils] ${errorMessage}`, fetchError);
        if (logChannel) {
            const errorEmbed = new EmbedBuilder()
                .setColor('Red')
                .setTitle(getTranslatedText(lang, 'autotimeout.TIMEOUT_FAILED_TITLE'))
                .setDescription(errorMessage)
                .setTimestamp();
            await logChannel.send({ embeds: [errorEmbed] }).catch(e => log.error("Fehler beim Senden des Timeout-Fehlerlogs (Member Fetch):", e));
        }
        return false;
    }

    // Force refresh bot member data
    const botMember = await guild.members.fetch({ user: guild.members.me.id, force: true });

    // EXTENDED DEBUGGING
    log.debug(`[TimeoutUtils DEBUG] ===================`);
    log.debug(`[TimeoutUtils DEBUG] Bot User ID: ${botMember.user.id}`);
    log.debug(`[TimeoutUtils DEBUG] Target User ID: ${targetMember.user.id}`);
    log.debug(`[TimeoutUtils DEBUG] Guild ID: ${guild.id}`);
    log.debug(`[TimeoutUtils DEBUG] Guild Owner ID: ${guild.ownerId}`);
    
    // Bot permissions
    const botPermissions = botMember.permissions.toArray();
    log.debug(`[TimeoutUtils DEBUG] Bot's alle Berechtigungen: [${botPermissions.join(', ')}]`);
    
    // Specific permission checks
    const hasModerateMembers = botMember.permissions.has(PermissionsBitField.Flags.ModerateMembers);
    const hasAdministrator = botMember.permissions.has(PermissionsBitField.Flags.Administrator);
    log.debug(`[TimeoutUtils DEBUG] Bot hat 'ModerateMembers' Berechtigung: ${hasModerateMembers}`);
    log.debug(`[TimeoutUtils DEBUG] Bot hat 'Administrator' Berechtigung: ${hasAdministrator}`);
    
    // Role hierarchy details
    const botHighestRolePosition = botMember.roles.highest.position;
    const targetHighestRolePosition = targetMember.roles.highest.position;
    log.debug(`[TimeoutUtils DEBUG] Bot's höchste Rolle: ${botMember.roles.highest.name} (Position: ${botHighestRolePosition})`);
    log.debug(`[TimeoutUtils DEBUG] Target's höchste Rolle: ${targetMember.roles.highest.name} (Position: ${targetHighestRolePosition})`);
    
    // All roles
    log.debug(`[TimeoutUtils DEBUG] Bot Rollen: ${botMember.roles.cache.map(r => `${r.name}(${r.position})`).join(', ')}`);
    log.debug(`[TimeoutUtils DEBUG] Target Rollen: ${targetMember.roles.cache.map(r => `${r.name}(${r.position})`).join(', ')}`);
    
    // Member manageable
    log.debug(`[TimeoutUtils DEBUG] Target ist manageable: ${targetMember.manageable}`);
    log.debug(`[TimeoutUtils DEBUG] Target ist moderatable: ${targetMember.moderatable}`);
    
    // Current timeout status
    log.debug(`[TimeoutUtils DEBUG] Target ist aktuell in Timeout: ${targetMember.communicationDisabledUntil ? 'Ja' : 'Nein'}`);
    if (targetMember.communicationDisabledUntil) {
        log.debug(`[TimeoutUtils DEBUG] Timeout endet: ${targetMember.communicationDisabledUntil}`);
    }
    
    log.debug(`[TimeoutUtils DEBUG] ===================`);

    // Prüfen, ob der Zielbenutzer der Serverbesitzer ist
    if (targetMember.user.id === guild.ownerId) {
        const errorMessage = getTranslatedText(lang, 'autotimeout.TIMEOUT_FAILED_IS_OWNER', { userTag: targetMember.user.tag });
        log.warn(`[TimeoutUtils] ${errorMessage}`);
        if (logChannel) {
            const errorEmbed = new EmbedBuilder()
                .setColor('Red')
                .setTitle(getTranslatedText(lang, 'autotimeout.TIMEOUT_FAILED_TITLE'))
                .setDescription(errorMessage)
                .setTimestamp();
            await logChannel.send({ embeds: [errorEmbed] }).catch(e => log.error("Fehler beim Senden des Timeout-Fehlerlogs (Is Owner):", e));
        }
        return false;
    }

    // Prüfen, ob der Zielbenutzer ein Bot ist
    if (targetMember.user.bot) {
        const errorMessage = getTranslatedText(lang, 'autotimeout.TIMEOUT_FAILED_IS_BOT', { userTag: targetMember.user.tag });
        log.warn(`[TimeoutUtils] ${errorMessage}`);
        if (logChannel) {
            const errorEmbed = new EmbedBuilder()
                .setColor('Red')
                .setTitle(getTranslatedText(lang, 'autotimeout.TIMEOUT_FAILED_TITLE'))
                .setDescription(errorMessage)
                .setTimestamp();
            await logChannel.send({ embeds: [errorEmbed] }).catch(e => log.error("Fehler beim Senden des Timeout-Fehlerlogs (Is Bot):", e));
        }
        return false;
    }

    // Use moderatable instead of manual checks
    if (!targetMember.moderatable) {
        const errorMessage = `Cannot timeout ${targetMember.user.tag}: User is not moderatable by bot`;
        log.error(`[TimeoutUtils] ${errorMessage}`);
        if (logChannel) {
            const errorEmbed = new EmbedBuilder()
                .setColor('Red')
                .setTitle(getTranslatedText(lang, 'autotimeout.TIMEOUT_FAILED_TITLE'))
                .setDescription(errorMessage)
                .setTimestamp();
            await logChannel.send({ embeds: [errorEmbed] }).catch(e => log.error("Fehler beim Senden des Timeout-Fehlerlogs:", e));
        }
        if (channelForUserFeedback) {
            await channelForUserFeedback.send({
                content: `Cannot timeout ${targetMember.user.tag}: Insufficient permissions`,
                ephemeral: true
            }).catch(e => log.error("Fehler beim Senden der Nutzer-Fehlermeldung:", e));
        }
        return false;
    }

    // Validate timeout duration (Discord limits)
    const maxTimeoutDuration = 28 * 24 * 60 * 60 * 1000; // 28 days in milliseconds
    if (durationMs > maxTimeoutDuration) {
        log.error(`[TimeoutUtils] Timeout duration too long: ${durationMs}ms (max: ${maxTimeoutDuration}ms)`);
        return false;
    }

    try {
        // Use the more direct approach with GuildMemberManager
        await guild.members.edit(targetMember.id, {
            communicationDisabledUntil: new Date(Date.now() + durationMs),
        }, reason);

        log.info(`[TimeoutUtils] Benutzer ${targetMember.user.tag} (${targetMember.id}) für ${ms(durationMs, { long: true })} in Timeout versetzt. Grund: ${reason}`);

        if (logChannel) {
            const embed = new EmbedBuilder()
                .setColor('Orange')
                .setTitle(getTranslatedText(lang, 'autotimeout.TIMEOUT_LOG_TITLE'))
                .setDescription(getTranslatedText(lang, 'autotimeout.TIMEOUT_LOG_DESCRIPTION', {
                    userTag: targetMember.user.tag,
                    duration: ms(durationMs, { long: true }),
                    reason: reason
                }))
                .addFields(
                    { name: getTranslatedText(lang, 'general.USER_ID'), value: targetMember.user.id, inline: true },
                    { name: getTranslatedText(lang, 'autotimeout.LOG_FIELD_DURATION'), value: ms(durationMs, { long: true }), inline: true },
                    { name: getTranslatedText(lang, 'autotimeout.LOG_FIELD_REASON'), value: reason, inline: false }
                )
                .setTimestamp();
            await logChannel.send({ embeds: [embed] }).catch(e => log.error("Fehler beim Senden des Timeout-Logs:", e));
        }

        await targetMember.send(getTranslatedText(lang, 'autotimeout.TIMEOUT_USER_DM', {
            guildName: guild.name,
            duration: ms(durationMs, { long: true }),
            reason: reason
        })).catch(e => log.warn(`[TimeoutUtils] Konnte Benutzer ${targetMember.user.tag} nicht per DM über Timeout informieren:`, e.message));

        return true;
    } catch (error) {
        // Enhanced error logging
        log.error(`[TimeoutUtils] Detailed error information:`);
        log.error(`[TimeoutUtils] Error Code: ${error.code}`);
        log.error(`[TimeoutUtils] Error Message: ${error.message}`);
        log.error(`[TimeoutUtils] Error Status: ${error.status}`);
        log.error(`[TimeoutUtils] Error Method: ${error.method}`);
        log.error(`[TimeoutUtils] Error URL: ${error.url}`);
        if (error.requestBody) {
            log.error(`[TimeoutUtils] Request Body:`, JSON.stringify(error.requestBody, null, 2));
        }
        
        const errorMessage = getTranslatedText(lang, 'autotimeout.TIMEOUT_FAILED_GENERIC', { userTag: targetMember.user.tag, reason: reason, errorMessage: error.message });
        log.error(`[TimeoutUtils] ${errorMessage}`, error);
        
        if (logChannel) {
            const errorEmbed = new EmbedBuilder()
                .setColor('Red')
                .setTitle(getTranslatedText(lang, 'autotimeout.TIMEOUT_FAILED_TITLE'))
                .setDescription(errorMessage)
                .addFields(
                    { name: 'Error Code', value: error.code?.toString() || 'Unknown', inline: true },
                    { name: 'Error Status', value: error.status?.toString() || 'Unknown', inline: true }
                )
                .setTimestamp();
            await logChannel.send({ embeds: [errorEmbed] }).catch(e => log.error("Fehler beim Senden des Timeout-Fehlerlogs:", e));
        }
        if (channelForUserFeedback) {
            await channelForUserFeedback.send({
                content: getTranslatedText(lang, 'autotimeout.TIMEOUT_FAILED_USER_NOTIFICATION_GENERIC', { userTag: targetMember.user.tag }),
                ephemeral: true
            }).catch(e => log.error("Fehler beim Senden der Nutzer-Fehlermeldung (Timeout-Generisch):", e));
        }
        return false;
    }
}

module.exports = {
    applyTimeout
};