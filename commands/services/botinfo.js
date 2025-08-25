import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import os from 'os';
import moment from 'moment';
import 'moment-duration-format';

// Die Korrektur befindet sich hier: Das `with { type: 'json' }` Attribut wurde hinzugefügt.
import packageJson from '../../package.json' with { type: 'json' };

import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

export const data = new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Zeigt detaillierte Informationen über den Bot an')
    .setDescriptionLocalizations({
        de: getTranslatedText('de', 'botinfo_command.DESCRIPTION'),
        'en-US': getTranslatedText('en', 'botinfo_command.DESCRIPTION'),
    });

export const category = 'Utility';

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const lang = getGuildLanguage(interaction.guild.id);

    try {
        const duration = moment.duration(process.uptime(), 'seconds').format('D [Tage], H [Stunden], m [Minuten], s [Sekunden]');
        const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const cpuModel = os.cpus()[0].model;
        const cpuCores = os.cpus().length;
        const platform = os.platform();
        const arch = os.arch();
        const discordJsVersion = process.env.DISCORDJS_VERSION || '14.x';

        const guildCount = interaction.client.guilds.cache.size;
        const userCount = interaction.client.users.cache.size;
        const channelCount = interaction.client.channels.cache.size;

        const embed = new EmbedBuilder()
            .setColor(0x00AE86)
            .setTitle(getTranslatedText(lang, 'botinfo_command.EMBED_TITLE'))
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .addFields(
                { name: getTranslatedText(lang, 'botinfo_command.FIELD_BOT_NAME'), value: interaction.client.user.tag, inline: true },
                { name: getTranslatedText(lang, 'botinfo_command.FIELD_CREATED_AT'), value: `<t:${Math.floor(interaction.client.user.createdTimestamp / 1000)}:F>`, inline: true },
                { name: getTranslatedText(lang, 'botinfo_command.FIELD_VERSION'), value: `v${packageJson.version}`, inline: true },
                { name: getTranslatedText(lang, 'botinfo_command.FIELD_UPTIME'), value: duration, inline: true },
                { name: getTranslatedText(lang, 'botinfo_command.FIELD_RAM_USAGE'), value: `${memoryUsage} MB`, inline: true },
                { name: getTranslatedText(lang, 'botinfo_command.FIELD_NODEJS_VERSION'), value: process.version, inline: true },
                { name: getTranslatedText(lang, 'botinfo_command.FIELD_DISCORDJS_VERSION'), value: `v${discordJsVersion}`, inline: true },
                { name: getTranslatedText(lang, 'botinfo_command.FIELD_SERVERS'), value: `${guildCount}`, inline: true },
                { name: getTranslatedText(lang, 'botinfo_command.FIELD_USERS'), value: `${userCount}`, inline: true },
                { name: getTranslatedText(lang, 'botinfo_command.FIELD_CHANNELS'), value: `${channelCount}`, inline: true },
                { name: getTranslatedText(lang, 'botinfo_command.FIELD_API_LATENCY'), value: `${interaction.client.ws.ping}ms`, inline: true },
                { name: getTranslatedText(lang, 'botinfo_command.FIELD_COMMANDS_LOADED'), value: `${interaction.client.commands.size}`, inline: true },
                { name: getTranslatedText(lang, 'botinfo_command.FIELD_PLATFORM'), value: `${platform} (${arch})`, inline: true },
                { name: getTranslatedText(lang, 'botinfo_command.FIELD_CPU'), value: `${cpuModel} (${cpuCores} Kerne)`, inline: true },
                { name: getTranslatedText(lang, 'botinfo_command.FIELD_DEVELOPER'), value: 'Ki, Lime#7543', inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        logger.info(`[BotInfo Command] Bot-Informationen für Gilde ${interaction.guild.name} (${interaction.guild.id}) angezeigt. (PID: ${process.pid})`);
    } catch (error) {
        logger.error(`[BotInfo Command] Fehler beim Abrufen der Bot-Informationen in Gilde ${interaction.guild.id}:`, error);
        await interaction.editReply({ content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'), ephemeral: true });
    }
}
