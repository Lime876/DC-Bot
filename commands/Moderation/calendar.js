import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

const calendarPath = path.join(path.dirname(new URL(import.meta.url).pathname), '../../data/calendar.json');

const loadCalendar = () => {
    if (fs.existsSync(calendarPath)) {
        try {
            return JSON.parse(fs.readFileSync(calendarPath, 'utf8'));
        } catch (e) {
            logger.error(`[Calendar] Fehler beim Parsen von ${calendarPath}:`, e);
            return {};
        }
    }
    return {};
};

const saveCalendar = (calendarData) => {
    try {
        const dir = path.dirname(calendarPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(calendarPath, JSON.stringify(calendarData, null, 2));
    } catch (e) {
        logger.error(`[Calendar] Fehler beim Schreiben in ${calendarPath}:`, e);
    }
};

export const data = new SlashCommandBuilder()
    .setName('calendar')
    .setDescription('Verwaltet oder zeigt Server-Ereignisse an.')
    .setDescriptionLocalizations({
        de: getTranslatedText('de', 'calendar_command.DESCRIPTION'),
        'en-US': getTranslatedText('en', 'calendar_command.DESCRIPTION'),
    })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addSubcommand(subcommand =>
        subcommand
            .setName('add')
            .setDescription('Fügt ein neues Ereignis zum Kalender hinzu.')
            .setDescriptionLocalizations({
                de: getTranslatedText('de', 'calendar_command.ADD_SUBCOMMAND_DESCRIPTION'),
                'en-US': getTranslatedText('en', 'calendar_command.ADD_SUBCOMMAND_DESCRIPTION'),
            })
            .addStringOption(option =>
                option.setName('titel')
                    .setDescription('Titel des Ereignisses')
                    .setDescriptionLocalizations({
                        de: getTranslatedText('de', 'calendar_command.TITLE_OPTION_DESCRIPTION'),
                        'en-US': getTranslatedText('en', 'calendar_command.TITLE_OPTION_DESCRIPTION'),
                    })
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('datum')
                    .setDescription('Datum des Ereignisses (Format: YYYY-MM-DD, z.B. 2025-12-24)')
                    .setDescriptionLocalizations({
                        de: getTranslatedText('de', 'calendar_command.DATE_OPTION_DESCRIPTION'),
                        'en-US': getTranslatedText('en', 'calendar_command.DATE_OPTION_DESCRIPTION'),
                    })
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('zeit')
                    .setDescription('Uhrzeit des Ereignisses (Format: HH:MM, z.B. 19:00)')
                    .setDescriptionLocalizations({
                        de: getTranslatedText('de', 'calendar_command.TIME_OPTION_DESCRIPTION'),
                        'en-US': getTranslatedText('en', 'calendar_command.TIME_OPTION_DESCRIPTION'),
                    })
                    .setRequired(false))
            .addStringOption(option =>
                option.setName('beschreibung')
                    .setDescription('Beschreibung des Ereignisses')
                    .setDescriptionLocalizations({
                        de: getTranslatedText('de', 'calendar_command.DESCRIPTION_OPTION_DESCRIPTION'),
                        'en-US': getTranslatedText('en', 'calendar_command.DESCRIPTION_OPTION_DESCRIPTION'),
                    })
                    .setRequired(false)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('list')
            .setDescription('Zeigt bevorstehende Server-Ereignisse an.')
            .setDescriptionLocalizations({
                de: getTranslatedText('de', 'calendar_command.LIST_SUBCOMMAND_DESCRIPTION'),
                'en-US': getTranslatedText('en', 'calendar_command.LIST_SUBCOMMAND_DESCRIPTION'),
            }))
    .addSubcommand(subcommand =>
        subcommand
            .setName('remove')
            .setDescription('Entfernt ein Ereignis aus dem Kalender.')
            .setDescriptionLocalizations({
                de: getTranslatedText('de', 'calendar_command.REMOVE_SUBCOMMAND_DESCRIPTION'),
                'en-US': getTranslatedText('en', 'calendar_command.REMOVE_SUBCOMMAND_DESCRIPTION'),
            })
            .addStringOption(option =>
                option.setName('event_id')
                    .setDescription('Die ID des zu entfernenden Ereignisses (zu finden in /calendar list)')
                    .setDescriptionLocalizations({
                        de: getTranslatedText('de', 'calendar_command.EVENT_ID_OPTION_DESCRIPTION'),
                        'en-US': getTranslatedText('en', 'calendar_command.EVENT_ID_OPTION_DESCRIPTION'),
                    })
                    .setRequired(true)));

export const category = 'Moderation';

export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const lang = await getGuildLanguage(guildId);
    const calendarData = loadCalendar();

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    if (!calendarData[guildId]) calendarData[guildId] = [];

    if (subcommand === 'add') {
        const title = interaction.options.getString('titel');
        const date = interaction.options.getString('datum');
        const time = interaction.options.getString('zeit') || getTranslatedText(lang, 'calendar_command.ALL_DAY');
        const description = interaction.options.getString('beschreibung') || getTranslatedText(lang, 'calendar_command.NO_DESCRIPTION_PROVIDED');

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return interaction.editReply({ content: getTranslatedText(lang, 'calendar_command.INVALID_DATE_FORMAT') });
        }

        if (time !== getTranslatedText(lang, 'calendar_command.ALL_DAY') && !/^(?:2[0-3]|[01]?[0-9]):[0-5][0-9]$/.test(time)) {
            return interaction.editReply({ content: getTranslatedText(lang, 'calendar_command.INVALID_TIME_FORMAT') });
        }

        const newEvent = {
            id: uuidv4(),
            title,
            description,
            date,
            time,
            creatorId: interaction.user.id,
            createdAt: Date.now()
        };

        calendarData[guildId].push(newEvent);
        saveCalendar(calendarData);

        const addEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle(getTranslatedText(lang, 'calendar_command.ADD_EMBED_TITLE'))
            .addFields(
                { name: getTranslatedText(lang, 'calendar_command.FIELD_TITLE'), value: title },
                { name: getTranslatedText(lang, 'calendar_command.FIELD_DATE'), value: date, inline: true },
                { name: getTranslatedText(lang, 'calendar_command.FIELD_TIME'), value: time, inline: true },
                { name: getTranslatedText(lang, 'calendar_command.FIELD_DESCRIPTION'), value: description }
            )
            .setFooter({ text: getTranslatedText(lang, 'calendar_command.ADD_EMBED_FOOTER', { eventId: newEvent.id, userTag: interaction.user.tag }) })
            .setTimestamp();

        await interaction.editReply({ embeds: [addEmbed] });
    } else if (subcommand === 'list') {
        const events = calendarData[guildId];

        if (!events || events.length === 0) {
            return interaction.editReply({ content: getTranslatedText(lang, 'calendar_command.LIST_NO_EVENTS') });
        }

        events.sort((a, b) => new Date(`${a.date}T${a.time === getTranslatedText(lang, 'calendar_command.ALL_DAY') ? '00:00' : a.time}`) - new Date(`${b.date}T${b.time === getTranslatedText(lang, 'calendar_command.ALL_DAY') ? '00:00' : b.time}`));

        const listEmbed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle(getTranslatedText(lang, 'calendar_command.LIST_EMBED_TITLE'))
            .setDescription(getTranslatedText(lang, 'calendar_command.LIST_EMBED_DESCRIPTION'))
            .setTimestamp();

        for (const event of events) {
            const eventDate = new Date(`${event.date}T${event.time === getTranslatedText(lang, 'calendar_command.ALL_DAY') ? '00:00' : event.time}`);
            const timestamp = Math.floor(eventDate.getTime() / 1000);

            listEmbed.addFields({
                name: `**${event.title}**`,
                value: getTranslatedText(lang, 'calendar_command.LIST_EVENT_VALUE', {
                    timestampDate: timestamp,
                    allDayText: getTranslatedText(lang, 'calendar_command.ALL_DAY'),
                    timestampTime: timestamp,
                    description: event.description,
                    eventId: event.id
                })
            });
        }

        await interaction.editReply({ embeds: [listEmbed] });
    } else if (subcommand === 'remove') {
        const eventId = interaction.options.getString('event_id');
        const events = calendarData[guildId];
        const initialLength = events.length;
        calendarData[guildId] = events.filter(event => event.id !== eventId);

        if (calendarData[guildId].length === initialLength) {
            return interaction.editReply({ content: getTranslatedText(lang, 'calendar_command.REMOVE_EVENT_NOT_FOUND') });
        }

        saveCalendar(calendarData);
        await interaction.editReply({ content: getTranslatedText(lang, 'calendar_command.REMOVE_SUCCESS', { eventId }) });
    }
}
