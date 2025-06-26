const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { getLogChannelId } = require('../../utils/config.js'); // Angenommen, du hast eine config.js für Log-Channels

module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Lässt den Bot eine Nachricht in einem Kanal senden.')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Die Nachricht, die gesendet werden soll.')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Der Kanal, in dem die Nachricht gesendet werden soll (Standard: aktueller Kanal).')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement) // Nur Text- oder Ankündigungskanäle
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages) // Nur Moderatoren/Admins
        .setDMPermission(false), // Nicht in DMs verfügbar

    category: 'Moderation', // Kategorie für den Befehl

    async execute(interaction) {
        const messageContent = interaction.options.getString('message');
        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
        const guildId = interaction.guild.id;

        await interaction.deferReply({ ephemeral: true }); // Sofort antworten, um Timeout zu vermeiden

        // Überprüfen, ob es ein Text- oder Ankündigungskanal ist
        if (targetChannel.type !== ChannelType.GuildText && targetChannel.type !== ChannelType.GuildAnnouncement) {
            return interaction.editReply({ content: '❌ Du kannst Nachrichten nur in Text- oder Ankündigungskanäle senden.', ephemeral: true });
        }

        // Überprüfen, ob der Bot die Berechtigung hat, Nachrichten zu senden
        const botPermissionsInChannel = targetChannel.permissionsFor(interaction.client.user);
        if (!botPermissionsInChannel.has(PermissionFlagsBits.SendMessages)) {
            return interaction.editReply({ content: `❌ Ich habe keine Berechtigung, Nachrichten in ${targetChannel} zu senden.`, ephemeral: true });
        }

        try {
            await targetChannel.send(messageContent);

            const embed = new EmbedBuilder()
                .setColor(0x00FF00) // Grün
                .setTitle('✅ Nachricht gesendet!')
                .setDescription(`Die Nachricht wurde erfolgreich in ${targetChannel} gesendet.`)
                .addFields(
                    { name: 'Kanal', value: `<#${targetChannel.id}>`, inline: true },
                    { name: 'Nachrichtenvorschau', value: `\`\`\`\n${messageContent.substring(0, 1000)}\n\`\`\``, inline: false } // Nur die ersten 1000 Zeichen
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // Optional: Log in einen Moderationskanal senden
            const logChannelId = getLogChannelId(guildId);
            if (logChannelId) {
                const logChannel = interaction.guild.channels.cache.get(logChannelId);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor(0x0099FF) // Blau
                        .setTitle('🗣️ Bot hat Nachricht gesendet')
                        .setDescription(`**${interaction.user.tag}** hat den Bot eine Nachricht senden lassen.`)
                        .addFields(
                            { name: 'Kanal', value: `<#${targetChannel.id}>`, inline: true },
                            { name: 'Gesendet von', value: `<@${interaction.user.id}>`, inline: true },
                            { name: 'Nachricht', value: messageContent.substring(0, 1024), inline: false } // Max. Länge für Embed-Feld
                        )
                        .setTimestamp();
                    await logChannel.send({ embeds: [logEmbed] }).catch(error => {
                        console.error("Failed to send say command log message: ", error);
                    });
                }
            }

        } catch (error) {
            console.error('Fehler beim Senden der Nachricht mit /say:', error);
            await interaction.editReply({
                content: '❌ Es gab einen Fehler beim Senden der Nachricht. Bitte stelle sicher, dass der Bot die nötigen Berechtigungen hat.',
                ephemeral: true,
            });
        }
    },
};