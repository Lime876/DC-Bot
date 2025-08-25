import { PermissionsBitField, EmbedBuilder } from 'discord.js';
import { getGuildLanguage, getTranslatedText } from './languageUtils.js';
import { getGuildAutotimeoutConfig } from './autotimeoutConfig.js';
import ms from 'ms';
import log from './logUtils.js';

if (!log.debug) log.debug = (...args) => log.info ? log.info(...args) : console.log(...args);

export async function applyTimeout(member, durationMs, reason, channelForUserFeedback = null) {
    if (!member || !member.id || !member.guild) {
        log.error('[TimeoutUtils] Ungültiges member-Objekt übergeben.');
        return false;
    }

    if (typeof durationMs !== 'number' || isNaN(durationMs) || durationMs <= 0) {
        log.error('[TimeoutUtils] Ungültige Timeout-Dauer (durationMs).');
        return false;
    }

    const guild = member.guild;
    const lang = getGuildLanguage(guild.id);
    const autotimeoutConfig = getGuildAutotimeoutConfig(guild.id) || {};

    let logChannel = null;
    if (autotimeoutConfig.moderationLogChannelId) {
        try {
            const ch = await guild.channels.fetch(autotimeoutConfig.moderationLogChannelId);
            if (ch && ch.isTextBased && ch.isTextBased()) {
                logChannel = ch;
            } else {
                log.warn(`[TimeoutUtils] Konfigurierter Log-Kanal (${autotimeoutConfig.moderationLogChannelId}) ist kein Textkanal.`);
            }
        } catch (e) {
            log.error('[TimeoutUtils] Fehler beim Abrufen des Log-Kanals:', e.message || e);
        }
    }

    let targetMember;
    try {
        targetMember = await guild.members.fetch({ user: member.id, force: true });
    } catch (fetchError) {
        const errorMessage = getTranslatedText(lang, 'autotimeout.TIMEOUT_FAILED_MEMBER_FETCH', { userTag: member.user?.tag || member.id, errorMessage: fetchError.message });
        log.error('[TimeoutUtils] Member-Fetch fehlgeschlagen:', fetchError);
        if (logChannel) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(getTranslatedText(lang, 'autotimeout.TIMEOUT_FAILED_TITLE'))
                .setDescription(errorMessage)
                .setTimestamp();
            await logChannel.send({ embeds: [errorEmbed] }).catch(e => log.error('[TimeoutUtils] Fehler beim Senden des Error-Embeds:', e.message || e));
        }
        return false;
    }

    let botMember = null;
    try {
        const botUserId = guild.members.me?.id || guild.client?.user?.id;
        if (!botUserId) throw new Error('Bot user id nicht verfügbar');
        botMember = await guild.members.fetch({ user: botUserId, force: true });
    } catch (e) {
        log.warn('[TimeoutUtils] Konnte Bot-Member nicht sicher abrufen:', e.message || e);
    }

    log.debug('[TimeoutUtils DEBUG] Guild:', guild.id, 'Target:', targetMember.id, 'BotMember:', botMember?.id || 'unknown');

    if (targetMember.user.id === guild.ownerId) {
        const errorMessage = getTranslatedText(lang, 'autotimeout.TIMEOUT_FAILED_IS_OWNER', { userTag: targetMember.user.tag });
        log.warn('[TimeoutUtils] Versuch, Owner zu timeouten:', targetMember.user.tag);
        if (logChannel) {
            const errorEmbed = new EmbedBuilder().setColor('#FF0000').setTitle(getTranslatedText(lang, 'autotimeout.TIMEOUT_FAILED_TITLE')).setDescription(errorMessage).setTimestamp();
            await logChannel.send({ embeds: [errorEmbed] }).catch(e => log.error('[TimeoutUtils] Fehler beim Senden Owner-Embed:', e.message || e));
        }
        return false;
    }

    if (targetMember.user.bot) {
        const errorMessage = getTranslatedText(lang, 'autotimeout.TIMEOUT_FAILED_IS_BOT', { userTag: targetMember.user.tag });
        log.warn('[TimeoutUtils] Ziel ist ein Bot:', targetMember.user.tag);
        if (logChannel) {
            const errorEmbed = new EmbedBuilder().setColor('#FF0000').setTitle(getTranslatedText(lang, 'autotimeout.TIMEOUT_FAILED_TITLE')).setDescription(errorMessage).setTimestamp();
            await logChannel.send({ embeds: [errorEmbed] }).catch(e => log.error('[TimeoutUtils] Error beim Senden Bot-Embed:', e.message || e));
        }
        return false;
    }

    if (!targetMember.moderatable) {
        const errorMessage = `Cannot timeout ${targetMember.user.tag}: User is not moderatable by bot`;
        log.error('[TimeoutUtils] Nicht moderierbar:', errorMessage);
        if (logChannel) {
            const errorEmbed = new EmbedBuilder().setColor('#FF0000').setTitle(getTranslatedText(lang, 'autotimeout.TIMEOUT_FAILED_TITLE')).setDescription(errorMessage).setTimestamp();
            await logChannel.send({ embeds: [errorEmbed] }).catch(e => log.error('[TimeoutUtils] Fehler beim Senden Moderatable-Embed:', e.message || e));
        }
        if (channelForUserFeedback) {
            try {
                if (typeof channelForUserFeedback.reply === 'function') {
                    await channelForUserFeedback.reply({ content: `Cannot timeout ${targetMember.user.tag}: Insufficient permissions`, ephemeral: true });
                } else if (typeof channelForUserFeedback.send === 'function') {
                    await channelForUserFeedback.send(`Cannot timeout ${targetMember.user.tag}: Insufficient permissions`);
                }
            } catch (e) {
                log.error('[TimeoutUtils] Fehler beim Senden der Nutzer-Fehlermeldung:', e.message || e);
            }
        }
        return false;
    }

    const maxTimeoutDuration = 28 * 24 * 60 * 60 * 1000;
    if (durationMs > maxTimeoutDuration) {
        log.error('[TimeoutUtils] Timeout-Dauer überschreitet 28 Tage.');
        return false;
    }

    try {
        if (typeof targetMember.timeout === 'function') {
            await targetMember.timeout(durationMs, reason);
        } else {
            await guild.members.edit(targetMember.id, { communicationDisabledUntil: new Date(Date.now() + durationMs) }, reason);
        }

        log.info(`[TimeoutUtils] ${targetMember.user.tag} für ${ms(durationMs, { long: true })} gecoolt. Grund: ${reason}`);

        if (logChannel) {
            const embed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle(getTranslatedText(lang, 'autotimeout.TIMEOUT_LOG_TITLE'))
                .setDescription(getTranslatedText(lang, 'autotimeout.TIMEOUT_LOG_DESCRIPTION', { userTag: targetMember.user.tag, duration: ms(durationMs, { long: true }), reason }))
                .addFields(
                    { name: getTranslatedText(lang, 'general.USER_ID'), value: targetMember.user.id, inline: true },
                    { name: getTranslatedText(lang, 'autotimeout.LOG_FIELD_DURATION'), value: ms(durationMs, { long: true }), inline: true },
                    { name: getTranslatedText(lang, 'autotimeout.LOG_FIELD_REASON'), value: reason || '—', inline: false }
                )
                .setTimestamp();
            await logChannel.send({ embeds: [embed] }).catch(e => log.error('[TimeoutUtils] Fehler beim Senden des Timeout-Logs:', e.message || e));
        }

        try {
            await targetMember.send(getTranslatedText(lang, 'autotimeout.TIMEOUT_USER_DM', { guildName: guild.name, duration: ms(durationMs, { long: true }), reason })).catch(e => log.warn('[TimeoutUtils] Konnte DM nicht senden:', e.message || e));
        } catch (dmErr) {
            log.warn('[TimeoutUtils] DM konnte nicht gesendet werden:', dmErr.message || dmErr);
        }

        return true;
    } catch (error) {
        log.error('[TimeoutUtils] Fehler beim Anwenden des Timeouts:', error.message || error);
        log.debug('[TimeoutUtils] Error details:', { code: error?.code, status: error?.status, method: error?.method, url: error?.url });

        const errorMessage = getTranslatedText(lang, 'autotimeout.TIMEOUT_FAILED_GENERIC', { userTag: targetMember.user.tag, reason: reason, errorMessage: error.message || 'Unknown' });
        if (logChannel) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(getTranslatedText(lang, 'autotimeout.TIMEOUT_FAILED_TITLE'))
                .setDescription(errorMessage)
                .addFields(
                    { name: 'Error Code', value: String(error?.code || 'Unknown'), inline: true },
                    { name: 'Error Status', value: String(error?.status || 'Unknown'), inline: true }
                )
                .setTimestamp();
            await logChannel.send({ embeds: [errorEmbed] }).catch(e => log.error('[TimeoutUtils] Fehler beim Senden des Error-Embed:', e.message || e));
        }

        if (channelForUserFeedback) {
            try {
                if (typeof channelForUserFeedback.reply === 'function') {
                    await channelForUserFeedback.reply({ content: getTranslatedText(lang, 'autotimeout.TIMEOUT_FAILED_USER_NOTIFICATION_GENERIC', { userTag: targetMember.user.tag }), ephemeral: true });
                } else if (typeof channelForUserFeedback.send === 'function') {
                    await channelForUserFeedback.send(getTranslatedText(lang, 'autotimeout.TIMEOUT_FAILED_USER_NOTIFICATION_GENERIC', { userTag: targetMember.user.tag }));
                }
            } catch (e) {
                log.error('[TimeoutUtils] Fehler beim Senden der Nutzer-Fehlermeldung nach Fehler:', e.message || e);
            }
        }

        return false;
    }
}
