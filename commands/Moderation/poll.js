// commands/moderation/poll.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Erstellt eine Umfrage mit Optionen.')
        .setDescriptionLocalizations({
            de: getTranslatedText('de', 'poll_command.DESCRIPTION'),
            'en-US': getTranslatedText('en', 'poll_command.DESCRIPTION'),
        })
        .addStringOption(option =>
            option.setName('frage')
                .setDescription('Die Frage der Umfrage')
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'poll_command.QUESTION_OPTION_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'poll_command.QUESTION_OPTION_DESCRIPTION'),
                })
                .setRequired(true))
        .addStringOption(option =>
            option.setName('option1')
                .setDescription('Erste Antwortoption')
                .setDescriptionLocalizations({ de: 'Erste Antwortoption', 'en-US': 'First answer option' })
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option2')
                .setDescription('Zweite Antwortoption')
                .setDescriptionLocalizations({ de: 'Zweite Antwortoption', 'en-US': 'Second answer option' })
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option3')
                .setDescription('Dritte Antwortoption')
                .setDescriptionLocalizations({ de: 'Dritte Antwortoption', 'en-US': 'Third answer option' })
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option4')
                .setDescription('Vierte Antwortoption')
                .setDescriptionLocalizations({ de: 'Vierte Antwortoption', 'en-US': 'Fourth answer option' })
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option5')
                .setDescription('Fünfte Antwortoption')
                .setDescriptionLocalizations({ de: 'Fünfte Antwortoption', 'en-US': 'Fifth answer option' })
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option6')
                .setDescription('Sechste Antwortoption')
                .setDescriptionLocalizations({ de: 'Sechste Antwortoption', 'en-US': 'Sixth answer option' })
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option7')
                .setDescription('Siebte Antwortoption')
                .setDescriptionLocalizations({ de: 'Siebte Antwortoption', 'en-US': 'Seventh answer option' })
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option8')
                .setDescription('Achte Antwortoption')
                .setDescriptionLocalizations({ de: 'Achte Antwortoption', 'en-US': 'Eighth answer option' })
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option9')
                .setDescription('Neunte Antwortoption')
                .setDescriptionLocalizations({ de: 'Neunte Antwortoption', 'en-US': 'Ninth answer option' })
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option10')
                .setDescription('Zehnte Antwortoption')
                .setDescriptionLocalizations({ de: 'Zehnte Antwortoption', 'en-US': 'Tenth answer option' })
                .setRequired(false)),

    category: 'Moderation',

    async execute(interaction) {
        const lang = await getGuildLanguage(interaction.guildId);

        // Defer reply immediately (poll message will be the public reply)
        await interaction.deferReply({ fetchReply: true });

        const question = interaction.options.getString('frage');
        const options = [];

        // Sammle alle Optionen
        for (let i = 1; i <= 10; i++) {
            const option = interaction.options.getString(`option${i}`);
            if (option) options.push(option);
        }

        const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
        const reactions = [];

        let description = getTranslatedText(lang, 'poll_command.POLL_STARTED_BY', { user: interaction.user.toString() }) + '\n\n';

        if (options.length > 0) {
            // Umfrage mit spezifischen Optionen
            for (let i = 0; i < options.length; i++) {
                if (i < emojis.length) {
                    description += `${emojis[i]} ${options[i]}\n`;
                    reactions.push(emojis[i]);
                } else {
                    logger.warn(`[Poll] Zu viele Optionen für verfügbare Emojis. Option ${options[i]} wird nicht angezeigt.`);
                }
            }
        } else {
            // Ja/Nein-Umfrage
            description += getTranslatedText(lang, 'poll_command.YES_NO_OPTIONS');
            reactions.push('👍','👎');
        }

        const pollEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(question)
            .setDescription(description)
            .setTimestamp()
            .setFooter({
                text: getTranslatedText(lang, 'poll_command.EMBED_FOOTER', { userTag: interaction.user.tag }),
                iconURL: interaction.user.displayAvatarURL()
            });

        const replyMessage = await interaction.editReply({ embeds: [pollEmbed] });

        // Füge Reaktionen hinzu
        for (const emoji of reactions) {
            try {
                await replyMessage.react(emoji);
            } catch (error) {
                logger.error(`[Poll] Fehler beim Hinzufügen der Reaktion ${emoji} zur Umfrage ${replyMessage.id}:`, error);
            }
        }
    }
};