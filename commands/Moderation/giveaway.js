// commands/giveaway.js
import {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    MessageFlags
} from 'discord.js';
import ms from 'ms';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Startet ein Gewinnspiel.')
        .setDescriptionLocalizations({
            de: getTranslatedText('de', 'giveaway_command.DESCRIPTION'),
            'en-US': getTranslatedText('en', 'giveaway_command.DESCRIPTION'),
        })
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(option =>
            option.setName('dauer')
                .setDescription('Wie lange soll das Gewinnspiel laufen? (z.B. 10m, 1h, 3d)')
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'giveaway_command.DURATION_OPTION_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'giveaway_command.DURATION_OPTION_DESCRIPTION'),
                })
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('gewinner')
                .setDescription('Anzahl der Gewinner')
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'giveaway_command.WINNER_COUNT_OPTION_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'giveaway_command.WINNER_COUNT_OPTION_DESCRIPTION'),
                })
                .setRequired(true)
                .setMinValue(1))
        .addStringOption(option =>
            option.setName('preis')
                .setDescription('Was gibt es zu gewinnen?')
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'giveaway_command.PRIZE_OPTION_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'giveaway_command.PRIZE_OPTION_DESCRIPTION'),
                })
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('kanal')
                .setDescription('Der Kanal, in dem das Gewinnspiel gepostet werden soll.')
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'giveaway_command.CHANNEL_OPTION_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'giveaway_command.CHANNEL_OPTION_DESCRIPTION'),
                })
                .setRequired(false)
                .addChannelTypes(0)),

    category: 'Moderation',

    async execute(interaction) {
        const lang = await getGuildLanguage(interaction.guildId);

        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const durationString = interaction.options.getString('dauer');
        const winnerCount = interaction.options.getInteger('gewinner');
        const prize = interaction.options.getString('preis');
        const channel = interaction.options.getChannel('kanal') || interaction.channel;

        const durationMs = ms(durationString);

        if (isNaN(durationMs) || durationMs <= 0) {
            return interaction.editReply({ content: getTranslatedText(lang, 'giveaway_command.INVALID_DURATION') });
        }

        const botPermissionsInChannel = channel.permissionsFor(interaction.client.user);
        const requiredPermissions = [
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AddReactions,
            PermissionFlagsBits.ViewChannel
        ];
        const missingPermissions = requiredPermissions.filter(p => !botPermissionsInChannel.has(p));

        if (missingPermissions.length > 0) {
            const permissionNames = missingPermissions.map(p => getTranslatedText(lang, `permissions.${p.toString()}`)).join(', ');
            return interaction.editReply({
                content: getTranslatedText(lang, 'giveaway_command.BOT_MISSING_PERMISSIONS', { permissions: permissionNames }),
            });
        }

        const giveawayEmbed = new EmbedBuilder()
            .setTitle(prize)
            .setDescription(getTranslatedText(lang, 'giveaway_command.EMBED_DESCRIPTION', {
                winnerCount: winnerCount,
                endTimeRelative: `<t:${Math.floor((Date.now() + durationMs) / 1000)}:R>`
            }))
            .setColor('Random')
            .setFooter({ text: getTranslatedText(lang, 'giveaway_command.EMBED_FOOTER') })
            .setTimestamp(Date.now() + durationMs);

        let message;
        try {
            message = await channel.send({ embeds: [giveawayEmbed] });
            await message.react('🎉');
            await interaction.editReply({
                content: getTranslatedText(lang, 'giveaway_command.SUCCESS_MESSAGE', {
                    prize: prize,
                    channelMention: channel.toString()
                })
            });
        } catch (error) {
            logger.error(`[Giveaway] Fehler beim Starten des Gewinnspiels in Gilde ${interaction.guild.id}:`, error);
            return interaction.editReply({ content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED_UNEXPECTED', { errorMessage: error.message }) });
        }

        setTimeout(async () => {
            try {
                const fetchedMessage = await channel.messages.fetch(message.id).catch(() => null);

                if (!fetchedMessage) {
                    logger.warn(`[Giveaway] Gewinnspielnachricht ${message.id} nicht gefunden, kann Ergebnis nicht verarbeiten.`);
                    return;
                }

                const reactions = fetchedMessage.reactions.cache.get('🎉');

                if (!reactions || reactions.users.cache.size <= 1) {
                    const noWinnersEmbed = new EmbedBuilder()
                        .setTitle(getTranslatedText(lang, 'giveaway_command.ENDED_TITLE'))
                        .setDescription(getTranslatedText(lang, 'giveaway_command.NO_WINNERS_DESCRIPTION', { prize: prize }))
                        .setColor('Red')
                        .setTimestamp();
                    return channel.send({ embeds: [noWinnersEmbed] });
                }

                const participants = reactions.users.cache.filter(user => !user.bot);

                if (participants.size === 0) {
                    const noWinnersEmbed = new EmbedBuilder()
                        .setTitle(getTranslatedText(lang, 'giveaway_command.ENDED_TITLE'))
                        .setDescription(getTranslatedText(lang, 'giveaway_command.NO_WINNERS_DESCRIPTION', { prize: prize }))
                        .setColor('Red')
                        .setTimestamp();
                    return channel.send({ embeds: [noWinnersEmbed] });
                }

                const actualWinnerCount = Math.min(winnerCount, participants.size);
                const winners = participants.random(actualWinnerCount);
                const winnerMentions = winners.map(user => `<@${user.id}>`).join(', ');

                const winnersEmbed = new EmbedBuilder()
                    .setTitle(getTranslatedText(lang, 'giveaway_command.ENDED_TITLE_SUCCESS'))
                    .setDescription(getTranslatedText(lang, 'giveaway_command.WINNERS_DESCRIPTION', { prize: prize, winnerMentions: winnerMentions }))
                    .setColor('Green')
                    .setFooter({ text: getTranslatedText(lang, 'giveaway_command.WINNERS_FOOTER') })
                    .setTimestamp();

                await channel.send({
                    content: getTranslatedText(lang, 'giveaway_command.WINNERS_ANNOUNCEMENT', { winnerMentions: winnerMentions, prize: prize }),
                    embeds: [winnersEmbed]
                });

            } catch (error) {
                logger.error(`[Giveaway] Fehler beim Beenden des Gewinnspiels für "${prize}" in Gilde ${interaction.guild.id}:`, error);
                await channel.send({ content: getTranslatedText(lang, 'giveaway_command.ERROR_ENDING_GIVEAWAY', { prize: prize, errorMessage: error.message }) });
            }
        }, durationMs);
    },
};