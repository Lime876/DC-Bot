const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Zeigt alle verfügbaren Befehle in Seitenform'),

    category: 'General', // <-- NEU: Füge diese Zeile hinzu, um die Kategorie zu definieren

    async execute(interaction) {
        try {
            const commands = [...interaction.client.commands.values()];
            const categorizedCommands = {};
            // Definiere eine gewünschte Reihenfolge für deine Kategorien
            const categoryOrder = ['General', 'Moderation', 'Utility', 'Admin', 'Ticket', 'Reaction Roles', 'Economey', 'Other']; 

            commands.forEach(cmd => {
                const category = cmd.category || 'Other'; // Standardkategorie, falls keine definiert ist
                if (!categorizedCommands[category]) {
                    categorizedCommands[category] = [];
                }
                categorizedCommands[category].push(cmd);
            });

            // Sortiere die Kategorien basierend auf der definierten Reihenfolge
            const sortedCategories = Object.keys(categorizedCommands).sort((a, b) => {
                const indexA = categoryOrder.indexOf(a);
                const indexB = categoryOrder.indexOf(b);

                // Wenn beide Kategorien nicht in categoryOrder sind, alphabetisch sortieren
                if (indexA === -1 && indexB === -1) {
                    return a.localeCompare(b);
                }
                // Wenn A nicht in categoryOrder ist, kommt es nach B
                if (indexA === -1) return 1;
                // Wenn B nicht in categoryOrder ist, kommt es nach A
                if (indexB === -1) return -1;
                // Ansonsten nach der definierten Reihenfolge
                return indexA - indexB;
            });

            const totalCategories = sortedCategories.length;
            let currentCategoryIndex = 0; // Index der aktuell angezeigten Kategorie

            // Funktion: Embed für eine spezifische Kategorie erstellen
            const generateEmbed = (categoryIndex) => {
                const currentCategoryName = sortedCategories[categoryIndex];
                const commandsInCategory = categorizedCommands[currentCategoryName];

                const embed = new EmbedBuilder()
                    .setTitle(`📖 ${currentCategoryName} Commands`) // Titel ist jetzt der Kategoriename
                    .setDescription(`Hier findest du eine Übersicht über die Commands in der Kategorie **${currentCategoryName}**.`)
                    .setColor(0x00AE86)
                    .setAuthor({ 
                        name: interaction.client.user.tag, 
                        iconURL: interaction.client.user.displayAvatarURL() 
                    })
                    .setFooter({ text: `Kategorie ${categoryIndex + 1} von ${totalCategories} | Nutze die Pfeile für weitere Kategorien.` })
                    .setTimestamp();

                if (commandsInCategory && commandsInCategory.length > 0) {
                    commandsInCategory.forEach(cmd => {
                        embed.addFields({
                            name: `**\`/${cmd.data.name}\`**`, // Befehlsname fett und im Code-Block
                            value: cmd.data.description || 'Keine Beschreibung vorhanden.',
                            inline: false,
                        });
                    });
                } else {
                    embed.addFields({ name: 'Keine Commands gefunden', value: 'In dieser Kategorie sind derzeit keine Befehle verfügbar.' });
                }
                
                return embed;
            };

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('prev')
                    .setLabel('⬅️ Zurück')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true), // Startet auf der ersten Kategorie, daher "Zurück" deaktiviert
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('➡️ Weiter')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(totalCategories <= 1) // Deaktiviert "Weiter", wenn nur eine Kategorie existiert
            );

            const message = await interaction.reply({
                embeds: [generateEmbed(currentCategoryIndex)],
                components: [row],
                ephemeral: true,
                fetchReply: true,
            });

            const collector = message.createMessageComponentCollector({
                time: 60_000, // 60 Sekunden aktiv
            });

            collector.on('collect', async i => {
                try {
                    if (i.user.id !== interaction.user.id) {
                        return i.reply({ content: '❌ Nur der ursprüngliche Nutzer kann hier blättern.', ephemeral: true });
                    }

                    if (i.customId === 'prev') {
                        currentCategoryIndex--;
                    } else if (i.customId === 'next') {
                        currentCategoryIndex++;
                    }

                    // Buttons updaten
                    row.components[0].setDisabled(currentCategoryIndex === 0);
                    row.components[1].setDisabled(currentCategoryIndex >= totalCategories - 1);

                    await i.update({
                        embeds: [generateEmbed(currentCategoryIndex)],
                        components: [row],
                    });
                } catch (error) {
                    console.error("Fehler beim Blättern durch Kategorien der Hilfe:", error);
                    await i.reply({ content: "❌ Beim Verarbeiten deiner Anfrage ist ein Fehler aufgetreten.", ephemeral: true }).catch(() => {});
                }
            });

            collector.on('end', () => {
                // Komponenten entfernen, wenn der Collector abgelaufen ist
                message.edit({ components: [] }).catch(() => {});
            });

        } catch (error) {
            console.error('Fehler beim Anzeigen der kategorisierten Hilfe:', error);
            await interaction.reply({
                content: '❌ Beim Anzeigen der kategorisierten Hilfe ist ein Fehler aufgetreten.',
                ephemeral: true,
            });
        }
    },
};