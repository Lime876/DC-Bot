const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const reactionRolesPath = path.join(__dirname, '../reactionRoles.json'); // Pfad zur reactionRoles.json

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reactionsetup')
        .setDescription('Erstelle eine Reaktionsrolle oder ein Button-Rolle-System.')
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
        .addRoleOption(option =>
            option.setName('rolle')
                .setDescription('Die Rolle, die zugewiesen werden soll.')
                .setRequired(true)
        )
        .addStringOption(option => // DIESE OPTION WURDE NACH OBEN VERSCHOBEN
            option.setName('typ')
                .setDescription('Wähle zwischen Reaktion (Emoji unter der Nachricht) oder Button.')
                .setRequired(true)
                .addChoices(
                    { name: 'Reaktion', value: 'reaction' },
                    { name: 'Button', value: 'button' }
                )
        )
        .addStringOption(option =>
            option.setName('emoji')
                .setDescription('Emoji für Reaktion oder Button (z.B. 👍 oder Rocket-Emoji-ID).')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('button_label')
                .setDescription('Text-Label für den Button (wenn kein Emoji verwendet wird).')
                .setRequired(false)
        ),

    async execute(interaction) {
        const channel = interaction.options.getChannel('kanal');
        const title = interaction.options.getString('titel');
        const description = interaction.options.getString('beschreibung');
        const role = interaction.options.getRole('rolle');
        const emoji = interaction.options.getString('emoji');
        const buttonLabel = interaction.options.getString('button_label');
        const type = interaction.options.getString('typ');

        // Berechtigungsprüfung: Bot muss Rollen verwalten können
        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return interaction.reply({
                content: '❌ Ich habe nicht die Berechtigung, Rollen zu verwalten. Bitte gib mir die `Rollen verwalten`-Berechtigung.',
                ephemeral: true
            });
        }

        // Berechtigungsprüfung: Bot darf keine Rolle geben, die über seiner eigenen ist
        if (role.position >= interaction.guild.members.me.roles.highest.position) {
            return interaction.reply({
                content: `❌ Ich kann die Rolle \`${role.name}\` nicht zuweisen, da sie höher oder gleich meiner höchsten Rolle ist.`,
                ephemeral: true
            });
        }

        // Überprüfe, ob für den Button-Typ entweder ein Emoji oder ein Label vorhanden ist
        if (type === 'button' && !emoji && !buttonLabel) {
            return interaction.reply({
                content: '❌ Für einen Button-Typ musst du entweder ein Emoji oder ein Button-Label angeben.',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor('Blurple')
            .setFooter({ text: `Rolle: ${role.name}` });

        try {
            let message;
            if (type === 'button') {
                const button = new ButtonBuilder()
                    .setCustomId(`reaction_role_${role.id}`) // Ein eindeutiger Custom ID für den Button
                    .setStyle(ButtonStyle.Primary);

                if (emoji) {
                    // Prüfen, ob es ein Discord-Emoji oder ein Unicode-Emoji ist
                    if (emoji.match(/<a?:\w+:\d+>/)) { // Discord Custom Emoji Regex
                        const customEmoji = interaction.client.emojis.cache.find(e => e.toString() === emoji);
                        if (customEmoji) {
                            button.setEmoji(customEmoji.id);
                        } else {
                            // Wenn Custom Emoji nicht gefunden wird, Log und weiter ohne Emoji
                            console.warn(`Benutzerdefiniertes Emoji ${emoji} nicht gefunden.`);
                        }
                    } else { // Unicode Emoji
                        button.setEmoji(emoji);
                    }
                }

                if (buttonLabel) {
                    button.setLabel(buttonLabel);
                } else if (!emoji) {
                    // Fallback, falls weder Emoji noch Label angegeben und es ein Button ist (sollte durch vorherige Prüfung abgefangen werden)
                    button.setLabel('Rolle erhalten');
                }

                const row = new ActionRowBuilder().addComponents(button);
                message = await channel.send({ embeds: [embed], components: [row] });
            } else { // type === 'reaction'
                message = await channel.send({ embeds: [embed] });
                if (emoji) {
                     // Prüfen, ob es ein Discord-Emoji oder ein Unicode-Emoji ist
                     if (emoji.match(/<a?:\w+:\d+>/)) { // Discord Custom Emoji Regex
                        const customEmoji = interaction.client.emojis.cache.find(e => e.toString() === emoji);
                        if (customEmoji) {
                            await message.react(customEmoji.id);
                        } else {
                            console.warn(`Benutzerdefiniertes Emoji ${emoji} nicht gefunden.`);
                            await interaction.followUp({ content: `⚠️ Das angegebene benutzerdefinierte Emoji \`${emoji}\` konnte nicht gefunden werden. Bitte stelle sicher, dass der Bot Zugriff darauf hat.`, ephemeral: true });
                        }
                    } else { // Unicode Emoji
                        await message.react(emoji);
                    }
                } else {
                    return interaction.followUp({ content: '❌ Für eine Reaktionsrolle muss ein Emoji angegeben werden.', ephemeral: true });
                }
            }

            // Speichern der Reaktionsrollen-Konfiguration
            let reactionRolesData = {};
            if (fs.existsSync(reactionRolesPath)) {
                reactionRolesData = JSON.parse(fs.readFileSync(reactionRolesPath, 'utf8'));
            }

            // Sicherstellen, dass die Nachricht-ID ein Schlüssel in reactionRolesData ist
            if (!reactionRolesData[message.id]) {
                reactionRolesData[message.id] = {};
            }

            // Je nach Typ speichern wir das Mapping
            if (type === 'button') {
                // Bei Buttons speichern wir nur den Rollen-ID, da der Custom ID eindeutig ist
                reactionRolesData[message.id][`button_${role.id}`] = role.id;
            } else { // type === 'reaction'
                reactionRolesData[message.id][emoji] = role.id;
            }

            fs.writeFileSync(reactionRolesPath, JSON.stringify(reactionRolesData, null, 2));

            await interaction.reply({
                content: `✅ Reaktionsrolle erfolgreich im Kanal ${channel} eingerichtet!`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Fehler beim Einrichten der Reaktionsrolle:', error);
            await interaction.reply({
                content: '❌ Es gab einen Fehler beim Einrichten der Reaktionsrolle. Bitte überprüfe die Berechtigungen des Bots und ob das Emoji gültig ist.',
                ephemeral: true
            });
        }
    },
};
