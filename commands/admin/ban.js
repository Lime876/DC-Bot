// commands/moderation/ban.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { getGuildLanguage, getTranslatedText } = require('../../utils/languageUtils');
const logger = require('../../utils/logger'); // Importiere den Logger

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bannt einen Benutzer vom Server') // Dies wird später über getTranslatedText geholt
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Der zu bannende Benutzer') // Übersetzbar
                .setRequired(true))
        .addStringOption(option =>
            option.setName('grund')
                .setDescription('Grund für den Ban') // Übersetzbar
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers), // Erfordert die Berechtigung, Mitglieder zu bannen

    category: 'admin', // Kategorie für den Befehl

    async execute(interaction) {
        const lang = await getGuildLanguage(interaction.guildId); // Sprache der Gilde abrufen

        // Übersetze die Beschreibung und Optionen des Befehls dynamisch für die Anzeige im Discord-Client
        // Dies ist wichtig, damit der Befehl in der richtigen Sprache angezeigt wird, wenn er zum ersten Mal bereitgestellt wird.
        // Beachte: Dies muss in der deploy-commands.js erfolgen, wenn du dynamische Übersetzungen für SlashCommandBuilder-Metadaten möchtest.
        // Für die Ausführung des Befehls selbst verwenden wir getTranslatedText direkt.
        module.exports.data
            .setDescription(getTranslatedText(lang, 'ban_command.DESCRIPTION'))
            .options[0].setDescription(getTranslatedText(lang, 'ban_command.USER_OPTION_DESCRIPTION'));
        module.exports.data
            .options[1].setDescription(getTranslatedText(lang, 'ban_command.REASON_OPTION_DESCRIPTION'));


        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('grund') || getTranslatedText(lang, 'ban_command.no_reason_provided');
        const targetMember = interaction.guild.members.cache.get(targetUser.id);

        // Überprüfe, ob der Bot die Berechtigung hat, Mitglieder zu bannen
        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
            logger.warn(`[Ban Command] Bot hat nicht die Berechtigung 'BanMembers' in Gilde ${interaction.guild.id}. (PID: ${process.pid})`);
            return interaction.reply({
                content: getTranslatedText(lang, 'ban_command.NO_PERMISSION_BOT'),
                flags: [MessageFlags.Ephemeral]
            });
        }

        // Überprüfe, ob der Benutzer sich selbst bannen will
        if (targetUser.id === interaction.user.id) {
            return interaction.reply({
                content: getTranslatedText(lang, 'ban_command.CANNOT_BAN_SELF'),
                flags: [MessageFlags.Ephemeral]
            });
        }

        // Überprüfe, ob der Benutzer einen anderen Bot bannen will (der Bot kann keine anderen Bots bannen)
        if (targetUser.bot) {
            return interaction.reply({
                content: getTranslatedText(lang, 'ban_command.CANNOT_BAN_BOT'),
                flags: [MessageFlags.Ephemeral]
            });
        }

        // Überprüfe, ob das Zielmitglied auf dem Server ist (es könnte bereits verlassen haben)
        if (!targetMember) {
            // Wenn der Benutzer nicht auf dem Server ist, aber gebannt werden soll, kann Discord dies trotzdem zulassen.
            // Wir können hier entscheiden, ob wir den Befehl trotzdem ausführen oder eine Fehlermeldung senden.
            // Für Konsistenz mit anderen Moderationsbefehlen (kick, timeout), die ein Member-Objekt benötigen,
            // behandeln wir es als Fehler, wenn der Benutzer kein Member ist.
            // Wenn der Benutzer gebannt werden soll, obwohl er nicht auf dem Server ist, muss man
            // interaction.guild.bans.create(targetUser.id, { reason: reason }) verwenden.
            // Da der Befehl 'addUserOption' verwendet, gehen wir davon aus, dass es sich um ein Member handelt.
            return interaction.reply({
                content: getTranslatedText(lang, 'ban_command.USER_NOT_ON_SERVER'),
                flags: [MessageFlags.Ephemeral]
            });
        }

        // Überprüfe die Rollenhierarchie des Bots im Vergleich zum Ziel
        if (!targetMember.bannable) {
            logger.warn(`[Ban Command] Bot kann Benutzer ${targetUser.tag} nicht bannen, da Rollenhierarchie zu niedrig in Gilde ${interaction.guild.id}. (PID: ${process.pid})`);
            return interaction.reply({
                content: getTranslatedText(lang, 'ban_command.CANNOT_BAN_HIGHER'),
                flags: [MessageFlags.Ephemeral]
            });
        }

        try {
            await targetMember.ban({ reason: reason });

            // Sende nur eine Bestätigung an den Benutzer, der den Befehl ausgeführt hat
            await interaction.reply({
                content: getTranslatedText(lang, 'ban_command.BAN_SUCCESS', { userTag: targetUser.tag, reason: reason }),
                flags: [MessageFlags.Ephemeral] // Nur für den Benutzer sichtbar
            });
            logger.info(`[Ban Command] Benutzer ${targetUser.tag} (${targetUser.id}) in Gilde ${interaction.guild.name} gebannt durch ${interaction.user.tag}. Grund: ${reason}. (PID: ${process.pid})`);

            // Das Logging an den Log-Kanal wird vom 'guildBanAdd' Event-Handler übernommen.

        } catch (error) {
            logger.error(`[Ban Command] Fehler beim Bannen von ${targetUser.tag} in Gilde ${interaction.guild.id}:`, error);
            await interaction.reply({
                content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'),
                flags: [MessageFlags.Ephemeral]
            });
        }
    },
};
