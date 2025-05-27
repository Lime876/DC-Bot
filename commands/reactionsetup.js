const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const reactionRolesPath = path.join(__dirname, '../reactionRoles.json'); // Pfad zur reactionRoles.json

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reactionsetup')
        .setDescription('Erstelle ein Reaktionsrollen-System mit mehreren Rollen und Emojis/Buttons.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addChannelOption(option =>
            option.setName('kanal')
                .setDescription('Der Kanal, in dem die Reaktionsrolle gesendet werden soll.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('titel')
                .setDescription('Der Titel des Embeds für die Reaktionsrolle.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('beschreibung')
                .setDescription('Die Beschreibung des Embeds für die Reaktionsrolle.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('typ')
                .setDescription('Wähle zwischen Reaktion (Emoji unter der Nachricht) oder Button.')
                .setRequired(true)
                .addChoices(
                    { name: 'Reaktion', value: 'reaction' },
                    { name: 'Button', value: 'button' }
                )
        )
        // Hinzufügen von 5 optionalen Paaren für Rolle und Emoji/Button-Label
        // (Wichtig: Alle Required-Optionen zuerst, dann alle Optionalen!)
        .addRoleOption(option =>
            option.setName('rolle1')
                .setDescription('Die erste Rolle, die zugewiesen werden soll.')
                .setRequired(false) // Jetzt optional, da man nur eine Rolle vergeben könnte
        )
        .addStringOption(option =>
            option.setName('emoji1')
                .setDescription('Emoji (z.B. 👍) oder ID für Rolle 1. Button-Label wenn Typ Button.')
                .setRequired(false)
        )
        .addRoleOption(option =>
            option.setName('rolle2')
                .setDescription('Die zweite Rolle, die zugewiesen werden soll.')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('emoji2')
                .setDescription('Emoji (z.B. 👍) oder ID für Rolle 2. Button-Label wenn Typ Button.')
                .setRequired(false)
        )
        .addRoleOption(option =>
            option.setName('rolle3')
                .setDescription('Die dritte Rolle, die zugewiesen werden soll.')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('emoji3')
                .setDescription('Emoji (z.B. 👍) oder ID für Rolle 3. Button-Label wenn Typ Button.')
                .setRequired(false)
        )
        .addRoleOption(option =>
            option.setName('rolle4')
                .setDescription('Die vierte Rolle, die zugewiesen werden soll.')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('emoji4')
                .setDescription('Emoji (z.B. 👍) oder ID für Rolle 4. Button-Label wenn Typ Button.')
                .setRequired(false)
        )
        .addRoleOption(option =>
            option.setName('rolle5')
                .setDescription('Die fünfte Rolle, die zugewiesen werden soll.')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('emoji5')
                .setDescription('Emoji (z.B. 👍) oder ID für Rolle 5. Button-Label wenn Typ Button.')
                .setRequired(false)
        ),

    async execute(interaction) {
        const channel = interaction.options.getChannel('kanal');
        const title = interaction.options.getString('titel');
        const description = interaction.options.getString('beschreibung');
        const type = interaction.options.getString('typ');

        // Sammle alle Rollen- und Emoji-Paare
        const roleEmojiPairs = [];
        for (let i = 1; i <= 5; i++) { // Wir iterieren bis zu 5 mögliche Paare
            const role = interaction.options.getRole(`rolle${i}`);
            const emojiOrLabel = interaction.options.getString(`emoji${i}`);

            if (role && emojiOrLabel) { // Nur hinzufügen, wenn beides angegeben ist
                roleEmojiPairs.push({ role, emojiOrLabel });
            } else if (role || emojiOrLabel) {
                // Wenn nur eines von beiden angegeben ist, gib eine Warnung zurück
                return interaction.reply({
                    content: `❌ Bitte gib für Rolle ${i} sowohl eine Rolle als auch ein Emoji/Label an, oder lass beides weg.`,
                    ephemeral: true
                });
            }
        }

        if (roleEmojiPairs.length === 0) {
            return interaction.reply({
                content: '❌ Du musst mindestens ein Rollen-Emoji/Label-Paar angeben!',
                ephemeral: true
            });
        }

        // Berechtigungsprüfung für alle Rollen
        for (const pair of roleEmojiPairs) {
            const role = pair.role;
            if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
                return interaction.reply({
                    content: '❌ Ich habe nicht die Berechtigung, Rollen zu verwalten. Bitte gib mir die `Rollen verwalten`-Berechtigung.',
                    ephemeral: true
                });
            }
            if (role.position >= interaction.guild.members.me.roles.highest.position) {
                return interaction.reply({
                    content: `❌ Ich kann die Rolle \`${role.name}\` nicht zuweisen, da sie höher oder gleich meiner höchsten Rolle ist.`,
                    ephemeral: true
                });
            }
        }

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor('Blurple');

        let message;
        const actionRow = new ActionRowBuilder(); // Für Buttons, falls Typ "button"

        try {
            const mappings = {}; // Zum Speichern der Emoji/Label -> RoleId Mappings

            if (type === 'button') {
                for (const pair of roleEmojiPairs) {
                    const role = pair.role;
                    const emojiOrLabel = pair.emojiOrLabel;

                    const button = new ButtonBuilder()
                        .setCustomId(`reaction_role_${role.id}`) // Eindeutiger Custom ID
                        .setStyle(ButtonStyle.Primary);

                    // Versuche, als Emoji zu setzen, wenn es ein gültiges Emoji ist
                    let isEmojiSet = false;
                    if (emojiOrLabel) {
                        // Prüfen, ob es ein Discord-Emoji oder ein Unicode-Emoji ist
                        if (emojiOrLabel.match(/<a?:\w+:\d+>/)) { // Discord Custom Emoji Regex
                            const customEmoji = interaction.client.emojis.cache.find(e => e.toString() === emojiOrLabel);
                            if (customEmoji) {
                                button.setEmoji(customEmoji.id);
                                isEmojiSet = true;
                            } else {
                                console.warn(`Benutzerdefiniertes Emoji ${emojiOrLabel} nicht gefunden für Button.`);
                                // Wenn Custom Emoji nicht gefunden, dann als Label verwenden
                                button.setLabel(emojiOrLabel);
                            }
                        } else { // Unicode Emoji
                            // Überprüfen, ob es ein einzelnes Unicode-Emoji ist
                            // Ein einfacher Regex für die meisten gängigen Emojis
                            const unicodeEmojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
                            if (emojiOrLabel.length <= 4 && unicodeEmojiRegex.test(emojiOrLabel)) { // Einfache Prüfung für Unicode
                                button.setEmoji(emojiOrLabel);
                                isEmojiSet = true;
                            } else {
                                button.setLabel(emojiOrLabel);
                            }
                        }
                    }

                    // Wenn kein Emoji gesetzt wurde, verwende das Label
                    if (!isEmojiSet && !button.data.label) { // Falls vorher kein Emoji gesetzt wurde und kein Label existiert
                        button.setLabel(emojiOrLabel || role.name); // Fallback zu Rollenname, falls Label auch leer
                    }

                    actionRow.addComponents(button);
                    mappings[emojiOrLabel] = role.id; // Speichern des Mappings
                }
                message = await channel.send({ embeds: [embed], components: [actionRow] });

            } else { // type === 'reaction'
                // Für Reaktionen fügen wir die Rollen-Namen und die Emojis zur Beschreibung hinzu
                const reactionDescription = roleEmojiPairs.map(pair => {
                    return `${pair.emojiOrLabel} - ${pair.role.name}`;
                }).join('\n');

                embed.setDescription(`${description}\n\n**Reagiere, um eine Rolle zu erhalten:**\n${reactionDescription}`);
                message = await channel.send({ embeds: [embed] });

                for (const pair of roleEmojiPairs) {
                    const emoji = pair.emojiOrLabel;
                    // Prüfen, ob es ein Discord-Emoji oder ein Unicode-Emoji ist
                    if (emoji.match(/<a?:\w+:\d+>/)) { // Discord Custom Emoji Regex
                        const customEmoji = interaction.client.emojis.cache.find(e => e.toString() === emoji);
                        if (customEmoji) {
                            await message.react(customEmoji.id);
                        } else {
                            console.warn(`Benutzerdefiniertes Emoji ${emoji} nicht gefunden für Reaktion.`);
                            await interaction.followUp({ content: `⚠️ Das angegebene benutzerdefinierte Emoji \`${emoji}\` konnte nicht gefunden werden oder ist ungültig.`, ephemeral: true });
                        }
                    } else { // Unicode Emoji
                        await message.react(emoji);
                    }
                    mappings[emoji] = pair.role.id; // Speichern des Mappings
                }
            }

            // Speichern der Reaktionsrollen-Konfiguration
            let reactionRolesData = {};
            if (fs.existsSync(reactionRolesPath)) {
                reactionRolesData = JSON.parse(fs.readFileSync(reactionRolesPath, 'utf8'));
            }
            reactionRolesData[message.id] = mappings; // Speichert alle Mappings für diese Nachricht

            fs.writeFileSync(reactionRolesPath, JSON.stringify(reactionRolesData, null, 2));

            await interaction.reply({
                content: `✅ Reaktionsrolle erfolgreich im Kanal ${channel} eingerichtet!`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Fehler beim Einrichten der Reaktionsrolle:', error);
            await interaction.reply({
                content: '❌ Es gab einen Fehler beim Einrichten der Reaktionsrolle. Bitte überprüfe die Berechtigungen des Bots, ob die Emojis gültig sind und ob ich genügend Rollen zur Auswahl stellen kann (max 5 für dieses Setup).',
                ephemeral: true
            });
        }
    },
};
