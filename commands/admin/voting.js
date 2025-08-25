import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import fs from 'fs';
import path from 'path';
import ms from 'ms';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

const activeVotesPath = path.join(new URL('.', import.meta.url).pathname, '../../data/activeVotes.json');

const loadActiveVotes = () => {
    if (fs.existsSync(activeVotesPath)) {
        try {
            return JSON.parse(fs.readFileSync(activeVotesPath, 'utf8'));
        } catch (e) {
            logger.error(`[Voting] Fehler beim Parsen von ${activeVotesPath}:`, e);
            return {};
        }
    }
    return {};
};

const saveActiveVotes = (votesData) => {
    try {
        const dir = path.dirname(activeVotesPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(activeVotesPath, JSON.stringify(votesData, null, 2));
    } catch (e) {
        logger.error(`[Voting] Fehler beim Schreiben in ${activeVotesPath}:`, e);
    }
};

export default {
    data: new SlashCommandBuilder()
        .setName('voting')
        .setDescription('Startet eine neue Abstimmung.')
        .setDescriptionLocalizations({
            de: getTranslatedText('de', 'voting_command.DESCRIPTION'),
            'en-US': getTranslatedText('en', 'voting_command.DESCRIPTION'),
        })
        .addStringOption(option =>
            option.setName('frage')
                .setDescription('Die Frage für die Abstimmung.')
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'voting_command.QUESTION_OPTION_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'voting_command.QUESTION_OPTION_DESCRIPTION'),
                })
                .setRequired(true))
        .addStringOption(option =>
            option.setName('dauer')
                .setDescription('Wie lange die Abstimmung dauern soll (z.B. 1h, 30m, 1d).')
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'voting_command.DURATION_OPTION_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'voting_command.DURATION_OPTION_DESCRIPTION'),
                })
                .setRequired(true)),

    category: 'Admin',

    async execute(interaction) {
        const lang = await getGuildLanguage(interaction.guildId);
        await interaction.deferReply({ fetchReply: true });

        const question = interaction.options.getString('frage');
        const durationString = interaction.options.getString('dauer');
        const guild = interaction.guild;
        const channel = interaction.channel;
        const userId = interaction.user.id;

        let durationMs = ms(durationString);
        if (!durationMs || durationMs < 10000 || durationMs > ms('7d')) {
            return interaction.editReply({
                content: getTranslatedText(lang, 'voting_command.INVALID_DURATION', { min: '10s', max: '7d', examples: '1h, 30m, 2d' }),
            });
        }

        const endTime = Date.now() + durationMs;

        const votingEmbed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle(getTranslatedText(lang, 'voting_command.VOTING_TITLE', { question }))
            .setDescription(getTranslatedText(lang, 'voting_command.VOTING_DESCRIPTION'))
            .addFields(
                { name: getTranslatedText(lang, 'voting_command.STARTED_BY'), value: `<@${userId}>`, inline: true },
                { name: getTranslatedText(lang, 'voting_command.ENDS_AT'), value: `<t:${Math.floor(endTime / 1000)}:F> (<t:${Math.floor(endTime / 1000)}:R>)`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: getTranslatedText(lang, 'voting_command.FOOTER_RUNNING') });

        const replyMessage = await interaction.editReply({ embeds: [votingEmbed] });

        await replyMessage.react('👍');
        await replyMessage.react('👎');

        let activeVotes = loadActiveVotes();
        activeVotes[replyMessage.id] = {
            guildId: guild.id,
            channelId: channel.id,
            messageId: replyMessage.id,
            question,
            endTime,
            initiatorId: userId,
        };
        saveActiveVotes(activeVotes);

        setTimeout(async () => {
            const fetchedMessage = await channel.messages.fetch(replyMessage.id).catch(() => null);
            if (!fetchedMessage) {
                logger.warn(`[VOTING] Abgeschlossene Abstimmung ${replyMessage.id} nicht gefunden.`);
                let votes = loadActiveVotes();
                delete votes[replyMessage.id];
                saveActiveVotes(votes);
                return;
            }

            const yesReactions = fetchedMessage.reactions.cache.get('👍')?.count - 1 || 0;
            const noReactions = fetchedMessage.reactions.cache.get('👎')?.count - 1 || 0;

            let resultDescription, resultColor;

            if (yesReactions > noReactions) {
                resultDescription = getTranslatedText(lang, 'voting_command.RESULT_YES');
                resultColor = 0x00FF00;
            } else if (noReactions > yesReactions) {
                resultDescription = getTranslatedText(lang, 'voting_command.RESULT_NO');
                resultColor = 0xFF0000;
            } else {
                resultDescription = getTranslatedText(lang, 'voting_command.RESULT_TIE');
                resultColor = 0xFFA500;
            }

            const resultsEmbed = new EmbedBuilder()
                .setColor(resultColor)
                .setTitle(getTranslatedText(lang, 'voting_command.RESULTS_TITLE', { question }))
                .setDescription(resultDescription)
                .addFields(
                    { name: getTranslatedText(lang, 'voting_command.RESULTS_YES_VOTES'), value: `${yesReactions}`, inline: true },
                    { name: getTranslatedText(lang, 'voting_command.RESULTS_NO_VOTES'), value: `${noReactions}`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: getTranslatedText(lang, 'voting_command.FOOTER_ENDED') });

            await fetchedMessage.reply({ embeds: [resultsEmbed] });

            let votes = loadActiveVotes();
            delete votes[replyMessage.id];
            saveActiveVotes(votes);
        }, durationMs);
    },

    async restoreActiveVotes(client) {
        const activeVotes = loadActiveVotes();
        const now = Date.now();

        for (const messageId in activeVotes) {
            const vote = activeVotes[messageId];
            const lang = await getGuildLanguage(vote.guildId);

            if (vote.endTime <= now) {
                try {
                    const guild = await client.guilds.fetch(vote.guildId).catch(() => null);
                    if (!guild) {
                        logger.warn(`[VOTING] Gilde ${vote.guildId} nicht gefunden.`);
                        delete activeVotes[messageId];
                        continue;
                    }
                    const channel = await guild.channels.fetch(vote.channelId).catch(() => null);
                    if (!channel) {
                        logger.warn(`[VOTING] Kanal ${vote.channelId} nicht gefunden.`);
                        delete activeVotes[messageId];
                        continue;
                    }
                    const fetchedMessage = await channel.messages.fetch(messageId).catch(() => null);
                    if (!fetchedMessage) {
                        logger.warn(`[VOTING] Nachricht ${messageId} nicht gefunden.`);
                        delete activeVotes[messageId];
                        continue;
                    }

                    const yesReactions = fetchedMessage.reactions.cache.get('👍')?.count - 1 || 0;
                    const noReactions = fetchedMessage.reactions.cache.get('👎')?.count - 1 || 0;

                    let resultDescription, resultColor;

                    if (yesReactions > noReactions) {
                        resultDescription = getTranslatedText(lang, 'voting_command.RESULT_YES');
                        resultColor = 0x00FF00;
                    } else if (noReactions > yesReactions) {
                        resultDescription = getTranslatedText(lang, 'voting_command.RESULT_NO');
                        resultColor = 0xFF0000;
                    } else {
                        resultDescription = getTranslatedText(lang, 'voting_command.RESULT_TIE');
                        resultColor = 0xFFA500;
                    }

                    const resultsEmbed = new EmbedBuilder()
                        .setColor(resultColor)
                        .setTitle(getTranslatedText(lang, 'voting_command.RESULTS_TITLE', { question: vote.question }))
                        .setDescription(resultDescription)
                        .addFields(
                            { name: getTranslatedText(lang, 'voting_command.RESULTS_YES_VOTES'), value: `${yesReactions}`, inline: true },
                            { name: getTranslatedText(lang, 'voting_command.RESULTS_NO_VOTES'), value: `${noReactions}`, inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ text: getTranslatedText(lang, 'voting_command.FOOTER_ENDED') });

                    await fetchedMessage.reply({ embeds: [resultsEmbed] });
                    delete activeVotes[messageId];
                } catch (error) {
                    logger.error(`[VOTING] Fehler beim Verarbeiten der abgelaufenen Abstimmung ${messageId}:`, error);
                    delete activeVotes[messageId];
                }
            } else {
                const timeLeft = vote.endTime - now;
                logger.info(`[VOTING] Wiederherstellen der Abstimmung ${messageId}. Endet in ${ms(timeLeft, { long: true })}.`);

                setTimeout(async () => {
                    const guild = await client.guilds.fetch(vote.guildId).catch(() => null);
                    if (!guild) return;
                    const channel = await guild.channels.fetch(vote.channelId).catch(() => null);
                    if (!channel) return;
                    const fetchedMessage = await channel.messages.fetch(messageId).catch(() => null);
                    if (!fetchedMessage) {
                        logger.warn(`[VOTING] Wiederhergestellte Abstimmung ${messageId} nicht gefunden.`);
                        return;
                    }

                    const yesReactions = fetchedMessage.reactions.cache.get('👍')?.count - 1 || 0;
                    const noReactions = fetchedMessage.reactions.cache.get('👎')?.count - 1 || 0;

                    let resultDescription, resultColor;

                    if (yesReactions > noReactions) {
                        resultDescription = getTranslatedText(lang, 'voting_command.RESULT_YES');
                        resultColor = 0x00FF00;
                    } else if (noReactions > yesReactions) {
                        resultDescription = getTranslatedText(lang, 'voting_command.RESULT_NO');
                        resultColor = 0xFF0000;
                    } else {
                        resultDescription = getTranslatedText(lang, 'voting_command.RESULT_TIE');
                        resultColor = 0xFFA500;
                    }

                    const resultsEmbed = new EmbedBuilder()
                        .setColor(resultColor)
                        .setTitle(getTranslatedText(lang, 'voting_command.RESULTS_TITLE', { question: vote.question }))
                        .setDescription(resultDescription)
                        .addFields(
                            { name: getTranslatedText(lang, 'voting_command.RESULTS_YES_VOTES'), value: `${yesReactions}`, inline: true },
                            { name: getTranslatedText(lang, 'voting_command.RESULTS_NO_VOTES'), value: `${noReactions}`, inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ text: getTranslatedText(lang, 'voting_command.FOOTER_ENDED') });

                    await fetchedMessage.reply({ embeds: [resultsEmbed] });

                    let finalVotes = loadActiveVotes();
                    delete finalVotes[messageId];
                    saveActiveVotes(finalVotes);

                }, timeLeft);
            }
        }
        saveActiveVotes(activeVotes);
    }
};