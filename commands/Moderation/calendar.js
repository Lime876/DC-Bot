// commands/calendar.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // Für eindeutige IDs

const calendarPath = path.join(__dirname, '../../data/calendar.json');

// Hilfsfunktion zum Laden/Speichern der Kalenderdaten
const loadCalendar = () => {
    if (fs.existsSync(calendarPath)) {
        try {
            return JSON.parse(fs.readFileSync(calendarPath, 'utf8'));
        } catch (e) {
            console.error(`Fehler beim Parsen von ${calendarPath}:`, e);
            return {};
        }
    }
    return {};
};

const saveCalendar = (calendarData) => {
    try {
        fs.writeFileSync(calendarPath, JSON.stringify(calendarData, null, 2));
    } catch (e) {
        console.error(`Fehler beim Schreiben in ${calendarPath}:`, e);
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('calendar')
        .setDescription('Verwaltet oder zeigt Server-Ereignisse an.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents) // Nur für Benutzer, die Events verwalten dürfen
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Fügt ein neues Ereignis zum Kalender hinzu.')
                .addStringOption(option =>
                    option.setName('titel')
                        .setDescription('Titel des Ereignisses')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('datum')
                        .setDescription('Datum des Ereignisses (Format: YYYY-MM-DD, z.B. 2025-12-24)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('zeit')
                        .setDescription('Uhrzeit des Ereignisses (Format: HH:MM, z.B. 19:00)')
                        .setRequired(false)) // Uhrzeit optional
                .addStringOption(option =>
                    option.setName('beschreibung')
                        .setDescription('Beschreibung des Ereignisses')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Zeigt bevorstehende Server-Ereignisse an.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Entfernt ein Ereignis aus dem Kalender.')
                .addStringOption(option =>
                    option.setName('event_id')
                        .setDescription('Die ID des zu entfernenden Ereignisses (zu finden in /calendar list)')
                        .setRequired(true))),

        category: 'Moderation', // <-- NEU: Füge diese Zeile hinzu

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const calendarData = loadCalendar();

        if (!calendarData[guildId]) {
            calendarData[guildId] = [];
        }

        if (subcommand === 'add') {
            const title = interaction.options.getString('titel');
            const date = interaction.options.getString('datum');
            const time = interaction.options.getString('zeit') || 'Ganztägig'; // Standardwert, wenn keine Zeit angegeben
            const description = interaction.options.getString('beschreibung') || 'Keine Beschreibung vorhanden.';

            // Basic Date Validation (YYYY-MM-DD)
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(date)) {
                return interaction.reply({ content: '❌ Ungültiges Datumsformat. Bitte verwende YYYY-MM-DD (z.B. 2025-12-24).', ephemeral: true });
            }

            // Basic Time Validation (HH:MM, if provided)
            if (time !== 'Ganztägig') {
                const timeRegex = /^(?:2[0-3]|[01]?[0-9]):[0-5][0-9]$/;
                if (!timeRegex.test(time)) {
                    return interaction.reply({ content: '❌ Ungültiges Zeitformat. Bitte verwende HH:MM (z.B. 19:00).', ephemeral: true });
                }
            }

            const newEvent = {
                id: uuidv4(), // Eindeutige ID generieren
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
                .setTitle('🗓️ Ereignis hinzugefügt!')
                .addFields(
                    { name: 'Titel', value: title },
                    { name: 'Datum', value: date, inline: true },
                    { name: 'Uhrzeit', value: time, inline: true },
                    { name: 'Beschreibung', value: description }
                )
                .setFooter({ text: `Ereignis-ID: ${newEvent.id} | Erstellt von ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.reply({ embeds: [addEmbed], ephemeral: true });

        } else if (subcommand === 'list') {
            const events = calendarData[guildId];

            if (!events || events.length === 0) {
                return interaction.reply({ content: '🗓️ Es sind derzeit keine Ereignisse im Kalender.', ephemeral: true });
            }

            // Sortiere Ereignisse nach Datum
            events.sort((a, b) => {
                const dateA = new Date(`${a.date}T${a.time === 'Ganztägig' ? '00:00' : a.time}`);
                const dateB = new Date(`${b.date}T${b.time === 'Ganztägig' ? '00:00' : b.time}`);
                return dateA.getTime() - dateB.getTime();
            });

            const listEmbed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('🗓️ Bevorstehende Server-Ereignisse')
                .setDescription('Hier ist eine Liste der geplanten Ereignisse:')
                .setTimestamp();

            // Füge jedes Ereignis als Feld hinzu
            for (const event of events) {
                const eventDate = new Date(`${event.date}T${event.time === 'Ganztägig' ? '00:00' : event.time}`);
                const timestamp = Math.floor(eventDate.getTime() / 1000); // Unix Timestamp für Discord-Formatierung

                listEmbed.addFields(
                    {
                        name: `**${event.title}**`,
                        value: `Datum: <t:${timestamp}:D> ${event.time === 'Ganztägig' ? '(Ganztägig)' : `um <t:${timestamp}:t>`}\nBeschreibung: ${event.description}\nID: \`${event.id}\``
                    }
                );
            }

            await interaction.reply({ embeds: [listEmbed], ephemeral: true });

        } else if (subcommand === 'remove') {
            const eventId = interaction.options.getString('event_id');
            let events = calendarData[guildId];

            const initialLength = events.length;
            calendarData[guildId] = events.filter(event => event.id !== eventId);
            
            if (calendarData[guildId].length === initialLength) {
                return interaction.reply({ content: '❌ Kein Ereignis mit dieser ID gefunden.', ephemeral: true });
            }

            saveCalendar(calendarData);
            await interaction.reply({ content: `✅ Ereignis mit ID \`${eventId}\` wurde erfolgreich entfernt.`, ephemeral: true });
        }
    },
};