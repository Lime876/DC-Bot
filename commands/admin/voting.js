// commands/voting.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageCollector } = require('discord.js');
const fs = require('fs');
const path = require('path');
const ms = require('ms'); // Für einfache Zeitumrechnung

// Pfad zur Datei für aktive Abstimmungen
const activeVotesPath = path.join(__dirname, '../../data/activeVotes.json'); // Zwei Ebenen nach oben

// Funktionen zum Laden und Speichern aktiver Abstimmungen
const loadActiveVotes = () => {
    if (fs.existsSync(activeVotesPath)) {
        try {
            return JSON.parse(fs.readFileSync(activeVotesPath, 'utf8'));
        } catch (e) {
            console.error(`Fehler beim Parsen von ${activeVotesPath}:`, e);
            return {};
        }
    }
    return {};
};

const saveActiveVotes = (votesData) => {
    try {
        fs.writeFileSync(activeVotesPath, JSON.stringify(votesData, null, 2));
    } catch (e) {
        console.error(`Fehler beim Schreiben in ${activeVotesPath}:`, e);
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voting')
        .setDescription('Startet eine neue Abstimmung.')
        .addStringOption(option =>
            option.setName('frage')
                .setDescription('Die Frage für die Abstimmung.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('dauer')
                .setDescription('Wie lange die Abstimmung dauern soll (z.B. 1h, 30m, 1d).')
                .setRequired(true)),
        // Optional: Berechtigung, wer Abstimmungen starten darf
        // .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels), // Nur wer Kanäle verwalten kann

    category: 'Admin', // Kategorie für den Befehl

    async execute(interaction) {
        const question = interaction.options.getString('frage');
        const durationString = interaction.options.getString('dauer');
        const guild = interaction.guild;
        const channel = interaction.channel;
        const userId = interaction.user.id;

        // Optional: Berechtigungsprüfung, falls nicht setDefaultMemberPermissions verwendet wird
        // if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        //     return interaction.reply({ content: '❌ Du hast nicht die Berechtigung, Abstimmungen zu starten.', ephemeral: true });
        // }

        let durationMs;
        try {
            durationMs = ms(durationString);
            if (!durationMs || durationMs < 10000 || durationMs > ms('7d')) { // Mindestens 10 Sekunden, maximal 7 Tage
                return interaction.reply({ content: '❌ Die Dauer muss gültig sein (mind. 10s, max. 7d). Beispiele: `1h`, `30m`, `2d`.', ephemeral: true });
            }
        } catch (error) {
            return interaction.reply({ content: '❌ Ungültiges Dauerformat. Beispiele: `1h`, `30m`, `2d`.', ephemeral: true });
        }

        const endTime = Date.now() + durationMs;

        const votingEmbed = new EmbedBuilder()
            .setColor(0x0099ff) // Blau
            .setTitle(`🗳️ Abstimmung: ${question}`)
            .setDescription('Stimme mit 👍 (Ja) oder 👎 (Nein) ab.')
            .addFields(
                { name: 'Gestartet von', value: `<@${userId}>`, inline: true },
                { name: 'Endet um', value: `<t:${Math.floor(endTime / 1000)}:F> (<t:${Math.floor(endTime / 1000)}:R>)`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Abstimmung läuft...' });

        const replyMessage = await interaction.reply({ embeds: [votingEmbed], fetchReply: true });

        // Füge Reaktionen für Abstimmung hinzu
        await replyMessage.react('👍');
        await replyMessage.react('👎');

        // Speichere die Abstimmung in der aktiven Liste
        let activeVotes = loadActiveVotes();
        activeVotes[replyMessage.id] = {
            guildId: guild.id,
            channelId: channel.id,
            messageId: replyMessage.id,
            question: question,
            endTime: endTime,
            initiatorId: userId
        };
        saveActiveVotes(activeVotes);

        // Starte den Timer für das Ende der Abstimmung
        setTimeout(async () => {
            const fetchedMessage = await channel.messages.fetch(replyMessage.id).catch(() => null);

            if (!fetchedMessage) {
                console.warn(`[VOTING] Abgeschlossene Abstimmung ${replyMessage.id} nicht gefunden.`);
                // Entferne die Abstimmung, wenn die Nachricht nicht gefunden wird
                let updatedVotes = loadActiveVotes();
                delete updatedVotes[replyMessage.id];
                saveActiveVotes(updatedVotes);
                return;
            }

            const yesReactions = fetchedMessage.reactions.cache.get('👍') ? fetchedMessage.reactions.cache.get('👍').count - 1 : 0; // -1 für Bot-Reaktion
            const noReactions = fetchedMessage.reactions.cache.get('👎') ? fetchedMessage.reactions.cache.get('👎').count - 1 : 0; // -1 für Bot-Reaktion

            let resultDescription;
            let resultColor;

            if (yesReactions > noReactions) {
                resultDescription = 'Die Abstimmung ist mit **JA** ausgegangen!';
                resultColor = 0x00FF00; // Grün
            } else if (noReactions > yesReactions) {
                resultDescription = 'Die Abstimmung ist mit **NEIN** ausgegangen!';
                resultColor = 0xFF0000; // Rot
            } else {
                resultDescription = 'Die Abstimmung ist unentschieden ausgegangen!';
                resultColor = 0xFFA500; // Orange
            }

            const resultsEmbed = new EmbedBuilder()
                .setColor(resultColor)
                .setTitle(`📊 Abstimmungsergebnis: ${question}`)
                .setDescription(resultDescription)
                .addFields(
                    { name: 'Ja-Stimmen 👍', value: `${yesReactions}`, inline: true },
                    { name: 'Nein-Stimmen 👎', value: `${noReactions}`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Abstimmung beendet.' });

            await fetchedMessage.reply({ embeds: [resultsEmbed] }); // Antwortet auf die Abstimmungsnachricht

            // Entferne die Abstimmung aus der aktiven Liste
            let updatedVotes = loadActiveVotes();
            delete updatedVotes[replyMessage.id];
            saveActiveVotes(updatedVotes);

        }, durationMs);
    },

    // Funktion zum Wiederherstellen von Abstimmungen nach Bot-Start
    // Muss in index.js aufgerufen werden
    async restoreActiveVotes(client) {
        const activeVotes = loadActiveVotes();
        const now = Date.now();

        for (const messageId in activeVotes) {
            const vote = activeVotes[messageId];

            if (vote.endTime <= now) {
                // Abstimmung ist bereits abgelaufen, verarbeite sie sofort
                try {
                    const guild = await client.guilds.fetch(vote.guildId).catch(() => null);
                    if (!guild) {
                        console.warn(`[VOTING] Gilde ${vote.guildId} für abgelaufene Abstimmung ${messageId} nicht gefunden.`);
                        delete activeVotes[messageId];
                        continue;
                    }
                    const channel = await guild.channels.fetch(vote.channelId).catch(() => null);
                    if (!channel) {
                        console.warn(`[VOTING] Kanal ${vote.channelId} für abgelaufene Abstimmung ${messageId} nicht gefunden.`);
                        delete activeVotes[messageId];
                        continue;
                    }
                    const fetchedMessage = await channel.messages.fetch(messageId).catch(() => null);
                    if (!fetchedMessage) {
                        console.warn(`[VOTING] Nachricht ${messageId} für abgelaufene Abstimmung nicht gefunden.`);
                        delete activeVotes[messageId];
                        continue;
                    }

                    const yesReactions = fetchedMessage.reactions.cache.get('👍') ? fetchedMessage.reactions.cache.get('👍').count - 1 : 0;
                    const noReactions = fetchedMessage.reactions.cache.get('👎') ? fetchedMessage.reactions.cache.get('👎').count - 1 : 0;

                    let resultDescription;
                    let resultColor;

                    if (yesReactions > noReactions) {
                        resultDescription = 'Die Abstimmung ist mit **JA** ausgegangen!';
                        resultColor = 0x00FF00;
                    } else if (noReactions > yesReactions) {
                        resultDescription = 'Die Abstimmung ist mit **NEIN** ausgegangen!';
                        resultColor = 0xFF0000;
                    } else {
                        resultDescription = 'Die Abstimmung ist unentschieden ausgegangen!';
                        resultColor = 0xFFA500;
                    }

                    const resultsEmbed = new EmbedBuilder()
                        .setColor(resultColor)
                        .setTitle(`📊 Abstimmungsergebnis: ${vote.question}`)
                        .setDescription(resultDescription)
                        .addFields(
                            { name: 'Ja-Stimmen 👍', value: `${yesReactions}`, inline: true },
                            { name: 'Nein-Stimmen 👎', value: `${noReactions}`, inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'Abstimmung beendet.' });

                    await fetchedMessage.reply({ embeds: [resultsEmbed] });
                    delete activeVotes[messageId]; // Entferne nach der Verarbeitung
                } catch (error) {
                    console.error(`Fehler beim Verarbeiten der abgelaufenen Abstimmung ${messageId}:`, error);
                    delete activeVotes[messageId]; // Entferne bei Fehler, um Schleife zu vermeiden
                }
            } else {
                // Abstimmung läuft noch, Timer neu setzen
                const timeLeft = vote.endTime - now;
                console.log(`[VOTING] Wiederherstellen der Abstimmung ${messageId}. Endet in ${ms(timeLeft, { long: true })}.`);

                setTimeout(async () => {
                    // Logik vom oberen execute-Block wiederholen, um die Ergebnisse zu posten
                    const guild = await client.guilds.fetch(vote.guildId).catch(() => null);
                    if (!guild) return;
                    const channel = await guild.channels.fetch(vote.channelId).catch(() => null);
                    if (!channel) return;
                    const fetchedMessage = await channel.messages.fetch(messageId).catch(() => null);
                    if (!fetchedMessage) {
                        console.warn(`[VOTING] Wiederhergestellte Abstimmung ${messageId} nicht gefunden. Kann nicht verarbeitet werden.`);
                        return;
                    }

                    const yesReactions = fetchedMessage.reactions.cache.get('👍') ? fetchedMessage.reactions.cache.get('👍').count - 1 : 0;
                    const noReactions = fetchedMessage.reactions.cache.get('👎') ? fetchedMessage.reactions.cache.get('👎').count - 1 : 0;

                    let resultDescription;
                    let resultColor;

                    if (yesReactions > noReactions) {
                        resultDescription = 'Die Abstimmung ist mit **JA** ausgegangen!';
                        resultColor = 0x00FF00;
                    } else if (noReactions > yesReactions) {
                        resultDescription = 'Die Abstimmung ist mit **NEIN** ausgegangen!';
                        resultColor = 0xFF0000;
                    } else {
                        resultDescription = 'Die Abstimmung ist unentschieden ausgegangen!';
                        resultColor = 0xFFA500;
                    }

                    const resultsEmbed = new EmbedBuilder()
                        .setColor(resultColor)
                        .setTitle(`📊 Abstimmungsergebnis: ${vote.question}`)
                        .setDescription(resultDescription)
                        .addFields(
                            { name: 'Ja-Stimmen 👍', value: `${yesReactions}`, inline: true },
                            { name: 'Nein-Stimmen 👎', value: `${noReactions}`, inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'Abstimmung beendet.' });

                    await fetchedMessage.reply({ embeds: [resultsEmbed] });

                    // Entferne die Abstimmung nach dem Abschluss
                    let finalVotes = loadActiveVotes();
                    delete finalVotes[messageId];
                    saveActiveVotes(finalVotes);

                }, timeLeft);
            }
        }
        saveActiveVotes(activeVotes); // Speichere aktualisierte Liste (falls Einträge gelöscht wurden)
    }
};