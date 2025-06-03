// events/interactionCreate.js
const { Events, ChannelType, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../data/ticketConfig.json'); // Pfad zur Konfigurationsdatei
const ticketsPath = path.join(__dirname, '../data/activeTickets.json'); // Für offene Tickets

// Funktion zum Laden/Speichern der Konfiguration
const loadConfig = () => {
    if (fs.existsSync(configPath)) {
        try {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (e) {
            console.error(`Fehler beim Parsen von ${configPath}:`, e);
            return {}; // Bei Parsing-Fehler leeres Objekt zurückgeben
        }
    }
    return {};
};

// Funktion zum Laden/Speichern der aktiven Tickets
const loadActiveTickets = () => {
    if (fs.existsSync(ticketsPath)) {
        try {
            return JSON.parse(fs.readFileSync(ticketsPath, 'utf8'));
        } catch (e) {
            console.error(`Fehler beim Parsen von ${ticketsPath}:`, e);
            return {}; // Bei Parsing-Fehler leeres Objekt zurückgeben
        }
    }
    return {};
};

const saveActiveTickets = (tickets) => {
    try {
        fs.writeFileSync(ticketsPath, JSON.stringify(tickets, null, 2));
    } catch (e) {
        console.error(`Fehler beim Schreiben in ${ticketsPath}:`, e);
    }
};

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        // *** GLOBALER TRY-CATCH-BLOCK FÜR ALLE INTERAKTIONEN ***
        try {
            // Button-Interaktionen verarbeiten
            if (interaction.isButton()) {
                // Das innere try...catch wird immer noch benötigt, um spezifische Fehler
                // für Button-Interaktionen abzufangen und benutzerfreundliche Nachrichten zu senden.
                try {
                    // Dynamisch generierte Buttons (aus reactionSetup)
                    if (interaction.customId.startsWith('reaction_')) {
                        const roleId = interaction.customId.replace('reaction_', '');
                        if (!roleId.match(/^\d+$/)) {
                            return await interaction.reply({ content: 'Ungültige Rollen-ID!', ephemeral: true });
                        }

                        const role = interaction.guild.roles.cache.get(roleId);
                        if (!role) return await interaction.reply({ content: 'Rolle existiert nicht mehr.', ephemeral: true });

                        if (interaction.member.roles.cache.has(role.id)) {
                            await interaction.member.roles.remove(role);
                            await interaction.reply({ content: `Rolle **${role.name}** entfernt.`, ephemeral: true });
                        } else {
                            await interaction.member.roles.add(role);
                            await interaction.reply({ content: `Rolle **${role.name}** hinzugefügt.`, ephemeral: true });
                        }
                    }

                    if (interaction.customId === 'create_ticket') {
                        const guildConfig = loadConfig()[interaction.guild.id];

                        if (!guildConfig) {
                            return interaction.reply({ content: '❌ Das Ticket-System ist auf diesem Server nicht eingerichtet.', ephemeral: true });
                        }

                        const ticketCategory = interaction.guild.channels.cache.get(guildConfig.ticketCategoryId);
                        const staffRole = interaction.guild.roles.cache.get(guildConfig.staffRoleId); // Das Role-Objekt
                        
                        if (!ticketCategory || !staffRole) {
                            console.error(`Ticket-Konfiguration unvollständig für Guild ${interaction.guild.id}: Kategorie ${guildConfig.ticketCategoryId}, Rolle ${guildConfig.staffRoleId}`);
                            return interaction.reply({ content: '❌ Das Ticket-System ist fehlerhaft konfiguriert. Bitte informiere einen Administrator.', ephemeral: true });
                        }

                        // Prüfen, ob der Benutzer bereits ein offenes Ticket hat
                        const activeTickets = loadActiveTickets();
                        const userOpenTicket = Object.values(activeTickets).find(ticket => ticket.userId === interaction.user.id && ticket.guildId === interaction.guild.id);
                        if (userOpenTicket) {
                            const existingChannel = interaction.guild.channels.cache.get(userOpenTicket.channelId);
                            if (existingChannel) {
                                return interaction.reply({ content: `⚠️ Du hast bereits ein offenes Ticket: ${existingChannel}. Bitte schließe dieses, bevor du ein neues öffnest.`, ephemeral: true });
                            } else {
                                // Ticket ist im Cache, aber Kanal existiert nicht mehr, also entfernen
                                delete activeTickets[userOpenTicket.channelId];
                                saveActiveTickets(activeTickets);
                            }
                        }

                        // Kanalberechtigungen für das neue Ticket
                        const permissions = [
                            {
                                id: interaction.guild.id, // @everyone
                                deny: [PermissionsBitField.Flags.ViewChannel],
                            },
                            {
                                id: interaction.user.id, // Ticket-Ersteller
                                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                            },
                            {
                                id: staffRole.id, // Moderatorenrolle
                                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageChannels],
                            },
                            {
                                id: interaction.client.user.id, // Bot selbst
                                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels],
                            }
                        ];

                        // Neuen Ticket-Kanal erstellen
                        const ticketChannel = await interaction.guild.channels.create({
                            name: `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '')}`, // Kanalname
                            type: ChannelType.GuildText,
                            parent: ticketCategory.id,
                            permissionOverwrites: permissions,
                        });

                        // Ticket in activeTickets speichern
                        activeTickets[ticketChannel.id] = {
                            userId: interaction.user.id,
                            guildId: interaction.guild.id,
                            channelId: ticketChannel.id,
                            createdAt: Date.now(),
                        };
                        saveActiveTickets(activeTickets);

                        // Willkommensnachricht im Ticket-Kanal
                        const welcomeEmbed = new EmbedBuilder()
                            .setColor(0x00FF00)
                            .setTitle('🎫 Dein Support-Ticket')
                            .setDescription(`Willkommen <@${interaction.user.id}>! Das Team wird sich bald um dein Anliegen kümmern.`)
                            .addFields(
                                { name: 'Dein Anliegen:', value: 'Bitte beschreibe dein Problem hier so detailliert wie möglich.' },
                            )
                            .setFooter({ text: `Ticket geöffnet von ${interaction.user.tag}` })
                            .setTimestamp();

                        const closeButton = new ButtonBuilder()
                            .setCustomId('close_ticket')
                            .setLabel('Ticket schließen')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('🔒');

                        const transcriptButton = new ButtonBuilder()
                            .setCustomId('transcript_ticket')
                            .setLabel('Transkript')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('📑'); // Optional: Button für Transkript

                        const ticketActionRow = new ActionRowBuilder().addComponents(closeButton, transcriptButton);

                        await ticketChannel.send({
                            content: `<@${interaction.user.id}> ${staffRole ? `<@&${staffRole.id}>` : ''}`, // Erwähnt den User und die Staff-Rolle
                            embeds: [welcomeEmbed],
                            components: [ticketActionRow],
                        });

                        await interaction.reply({ content: `✅ Dein Ticket wurde erstellt: ${ticketChannel}`, ephemeral: true });

                    } else if (interaction.customId === 'close_ticket') {
                        // Hier die Logik zum Schließen des Tickets
                        const activeTickets = loadActiveTickets();
                        const ticketInfo = activeTickets[interaction.channel.id];

                        if (!ticketInfo) {
                            return interaction.reply({ content: '❌ Dies ist kein aktives Ticket oder es wurde nicht über dieses System geöffnet.', ephemeral: true });
                        }

                        // Bestätigung für das Schließen
                        const confirmCloseButton = new ButtonBuilder()
                            .setCustomId('confirm_close_ticket')
                            .setLabel('Ja, schließen')
                            .setStyle(ButtonStyle.Danger);

                        const cancelCloseButton = new ButtonBuilder()
                            .setCustomId('cancel_close_ticket')
                            .setLabel('Abbrechen')
                            .setStyle(ButtonStyle.Secondary);

                        const confirmRow = new ActionRowBuilder().addComponents(confirmCloseButton, cancelCloseButton);

                        await interaction.reply({
                            content: 'Bist du sicher, dass du dieses Ticket schließen möchtest? Dies kann nicht rückgängig gemacht werden.',
                            components: [confirmRow],
                            ephemeral: true, // Ephemeral, damit nur der Ausführende es sieht
                        });
                    } else if (interaction.customId === 'confirm_close_ticket') {
                        const activeTickets = loadActiveTickets();
                        const ticketInfo = activeTickets[interaction.channel.id];

                        if (!ticketInfo) {
                            return interaction.reply({ content: '❌ Dies ist kein aktives Ticket oder es wurde nicht über dieses System geöffnet.', ephemeral: true });
                        }

                        // Protokollierung der Schließung
                        // guildConfig muss hier neu geladen werden, da es in diesem Scope nicht definiert ist
                        const guildConfig = loadConfig()[interaction.guild.id]; 
                        const logChannelId = guildConfig ? guildConfig.logChannelId : null; // Annahme: Log-Channel in ticketConfig
                        if (logChannelId) {
                            const logChannel = interaction.guild.channels.cache.get(logChannelId);
                            if (logChannel) {
                                const closeEmbed = new EmbedBuilder()
                                    .setColor(0xFF0000)
                                    .setTitle('Ticket geschlossen')
                                    .addFields(
                                        { name: 'Ticket-ID', value: interaction.channel.id, inline: true },
                                        { name: 'Eröffnet von', value: `<@${ticketInfo.userId}>`, inline: true },
                                        { name: 'Geschlossen von', value: `<@${interaction.user.id}>`, inline: true },
                                        { name: 'Kanalname', value: interaction.channel.name, inline: true },
                                    )
                                    .setTimestamp();
                                await logChannel.send({ embeds: [closeEmbed] }).catch(console.error);
                            }
                        }

                        // Ticket aus activeTickets entfernen
                        delete activeTickets[interaction.channel.id];
                        saveActiveTickets(activeTickets);

                        await interaction.channel.delete('Ticket geschlossen durch Command.');
                        // Es ist hier keine weitere reply oder editReply nötig, da der Kanal gelöscht wird.

                    } else if (interaction.customId === 'cancel_close_ticket') {
                        await interaction.reply({ content: 'Ticket-Schließung abgebrochen.', ephemeral: true });
                    }

                    // ... (weitere Button-Handler) ...

                } catch (error) {
                    console.error('Fehler bei spezifischer Button-Interaktion:', error); // Spezifischerer Log
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: 'Ein Fehler ist aufgetreten!', ephemeral: true });
                    } else if (interaction.deferred) {
                        await interaction.editReply({ content: 'Ein Fehler ist aufgetreten!', ephemeral: true });
                    }
                }
            }
            // Slash Commands verarbeiten
            else if (interaction.isChatInputCommand()) {
                const command = client.commands.get(interaction.commandName);
                if (!command) return; // Command existiert nicht oder wurde nicht geladen
                try {
                    await command.execute(interaction);
                } catch (error) {
                    console.error(`Fehler beim Ausführen von /${interaction.commandName}:`, error);
                    // Robuste Fehlerantwort für Slash Commands
                    if (interaction.deferred || interaction.replied) {
                        await interaction.followUp({ content: 'Beim Ausführen dieses Befehls ist ein Fehler aufgetreten!', ephemeral: true }).catch(() => {});
                    } else {
                        await interaction.reply({ content: 'Beim Ausführen dieses Befehls ist ein Fehler aufgetreten!', ephemeral: true }).catch(() => {});
                    }
                }
            }
            // Context Menu Commands verarbeiten (falls vorhanden)
            else if (interaction.isContextMenuCommand()) {
                const command = client.commands.get(interaction.commandName);
                if (!command) return;
                try {
                    await command.execute(interaction);
                } catch (error) {
                    console.error(`Fehler beim Ausführen von Kontextmenü-Befehl ${interaction.commandName}:`, error);
                    if (interaction.deferred || interaction.replied) {
                        await interaction.followUp({ content: 'Beim Ausführen dieses Befehls ist ein Fehler aufgetreten!', ephemeral: true }).catch(() => {});
                    } else {
                        await interaction.reply({ content: 'Beim Ausführen dieses Befehls ist ein Fehler aufgetreten!', ephemeral: true }).catch(() => {});
                    }
                }
            }
            // Autocomplete Interaktionen verarbeiten (falls vorhanden)
            else if (interaction.isAutocomplete()) {
                const command = client.commands.get(interaction.commandName);
                if (!command || !command.autocomplete) return;
                try {
                    await command.autocomplete(interaction);
                } catch (error) {
                    console.error(`Fehler bei Autocomplete für /${interaction.commandName}:`, error);
                }
            }

        } catch (globalError) {
            console.error('Ein **globaler Fehler** in interactionCreate aufgetreten:', globalError);
            // Versuche, dem Benutzer eine Fehlermeldung zu senden, falls noch nicht geantwortet
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Ein unerwarteter Fehler ist aufgetreten! Der Bot-Entwickler wurde benachrichtigt.', ephemeral: true }).catch(() => {});
            } else if (interaction.deferred) {
                await interaction.editReply({ content: '❌ Ein unerwarteter Fehler ist aufgetreten! Der Bot-Entwickler wurde benachrichtigt.', ephemeral: true }).catch(() => {});
            }
        }
    },
};
