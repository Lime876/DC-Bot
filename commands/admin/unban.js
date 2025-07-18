// commands/moderation/unban.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { getGuildLanguage, getTranslatedText } = require('../../utils/languageUtils');
const logger = require('../../utils/logger'); // Importiere den Logger

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Entbannt einen Benutzer über die Benutzer-ID') // Dies wird später über getTranslatedText geholt
        .addStringOption(option =>
            option.setName('userid')
                .setDescription('Die ID des Benutzers, der entbannt werden soll') // Übersetzbar
                .setRequired(true))
        .addStringOption(option =>
            option.setName('grund')
                .setDescription('Grund für das Entbannen') // Übersetzbar
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers), // Erfordert die Berechtigung, Mitglieder zu bannen

    category: 'admin', // Kategorie für den Befehl

    async execute(interaction) {
        const lang = await getGuildLanguage(interaction.guildId); // Sprache der Gilde abrufen

        // Übersetze die Beschreibung und Optionen des Befehls dynamisch für die Anzeige im Discord-Client
        // Dies ist wichtig, damit der Befehl in der richtigen Sprache angezeigt wird, wenn er zum ersten Mal bereitgestellt wird.
        module.exports.data
            .setDescription(getTranslatedText(lang, 'unban_command.DESCRIPTION'))
            .options[0].setDescription(getTranslatedText(lang, 'unban_command.USER_ID_OPTION_DESCRIPTION'));
        module.exports.data
            .options[1].setDescription(getTranslatedText(lang, 'unban_command.REASON_OPTION_DESCRIPTION'));

        const userId = interaction.options.getString('userid');
        const reason = interaction.options.getString('grund') || getTranslatedText(lang, 'unban_command.NO_REASON_PROVIDED');

        // Überprüfe, ob der Bot die Berechtigung hat, Mitglieder zu entbannen
        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
            logger.warn(`[Unban Command] Bot hat nicht die Berechtigung 'BanMembers' in Gilde ${interaction.guild.id}. (PID: ${process.pid})`);
            return interaction.reply({
                content: getTranslatedText(lang, 'unban_command.NO_PERMISSION_BOT'),
                flags: [MessageFlags.Ephemeral]
            });
        }

        try {
            // Versuche, den Bann zu fetchen, um zu überprüfen, ob der Benutzer tatsächlich gebannt ist
            const ban = await interaction.guild.bans.fetch(userId);
            if (!ban) {
                return interaction.reply({
                    content: getTranslatedText(lang, 'unban_command.USER_NOT_BANNED'),
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Entbanne den Benutzer
            await interaction.guild.members.unban(userId, reason);

            // Sende nur eine Bestätigung an den Benutzer, der den Befehl ausgeführt hat
            await interaction.reply({
                content: getTranslatedText(lang, 'unban_command.SUCCESS', { userId: userId, reason: reason }),
                flags: [MessageFlags.Ephemeral] // Nur für den Benutzer sichtbar
            });
            logger.info(`[Unban Command] Benutzer mit ID ${userId} in Gilde ${interaction.guild.name} entbannt durch ${interaction.user.tag}. Grund: ${reason}. (PID: ${process.pid})`);

            // Das Logging an den Log-Kanal wird vom 'guildBanRemove' Event-Handler übernommen.

        } catch (error) {
            logger.error(`[Unban Command] Fehler beim Entbannen von Benutzer ID ${userId} in Gilde ${interaction.guild.id}:`, error);
            // Überprüfe, ob der Fehler darauf hinweist, dass der Benutzer nicht gebannt ist (z.B. Discord API Error 10026 Unknown Ban)
            if (error.code === 10026) { // Discord API Error Code for Unknown Ban
                return interaction.reply({
                    content: getTranslatedText(lang, 'unban_command.USER_NOT_BANNED'),
                    flags: [MessageFlags.Ephemeral]
                });
            }
            await interaction.reply({
                content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'),
                flags: [MessageFlags.Ephemeral]
            });
        }
    },
};
