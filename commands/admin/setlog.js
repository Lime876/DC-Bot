// commands/utility/setlog.js
const { SlashCommandBuilder, PermissionsBitField, ChannelType, MessageFlags } = require('discord.js'); // MessageFlags importieren
const { setLogChannelId } = require('../../utils/config.js');
const { getGuildLanguage, getTranslatedText } = require('../../utils/languageUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setlog')
        .setDescription('Setzt oder entfernt den Log-Kanal für verschiedene Ereignisse.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild) // Nur für Server-Manager
        .addStringOption(option =>
            option.setName('log_type')
                .setDescription('Der Typ des Log-Ereignisses (z.B. message_delete, member_join)')
                .setRequired(true)
                .addChoices(
                    { name: 'Nachricht gelöscht', value: 'message_delete' },
                    { name: 'Nachricht bearbeitet', value: 'message_edit' },
                    { name: 'Mitglied beigetreten', value: 'member_join' },
                    { name: 'Mitglied verlassen', value: 'member_leave' },
                    { name: 'Bann', value: 'member_ban' },
                    { name: 'Entbann', value: 'member_unban' },
                    { name: 'Kanal erstellt', value: 'channel_create' },
                    { name: 'Kanal gelöscht', value: 'channel_delete' },
                    { name: 'Rolle erstellt', value: 'role_create' },
                    { name: 'Rolle gelöscht', value: 'role_delete' },
                    { name: 'Server Updates', value: 'guild_update' },
                    { name: 'Sprachkanal beigetreten', value: 'voice_join' },
                    { name: 'Sprachkanal verlassen', value: 'voice_leave' },
                    { name: 'Sprachkanal gewechselt', value: 'voice_move' },
                    { name: 'JTC Kanal erstellt', value: 'jtc_channel_create' },
                    { name: 'JTC Kanal gelöscht', value: 'jtc_channel_delete' },
                    { name: 'Server Updates', value: 'guild_update' }
                    // Füge hier weitere Log-Typen hinzu, wenn dein Bot sie unterstützt
                ))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Der Kanal, der als Log-Kanal festgelegt werden soll (leer lassen zum Entfernen).')
                .addChannelTypes(ChannelType.GuildText) // Nur Textkanäle erlauben
                .setRequired(false)),

    async execute(interaction) {
        const lang = getGuildLanguage(interaction.guildId);
        const logType = interaction.options.getString('log_type');
        const channel = interaction.options.getChannel('channel');

        // Überprüfe Berechtigungen
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) {
            await interaction.reply({
                content: getTranslatedText(lang, 'setlog.NO_PERMISSION'),
                flags: [MessageFlags.Ephemeral] // Korrektur: ephemeral: true durch flags ersetzen
            });
            return;
        }

        if (channel) {
            // Setze den Log-Kanal
            setLogChannelId(interaction.guild.id, logType, channel.id);
            await interaction.reply({
                content: getTranslatedText(lang, 'setlog.SET_SUCCESS', { logType: logType, channelMention: channel.toString() }),
                flags: [MessageFlags.Ephemeral] // Korrektur: ephemeral: true durch flags ersetzen
            });
        } else {
            // Entferne den Log-Kanal
            setLogChannelId(interaction.guild.id, logType, null);
            await interaction.reply({
                content: getTranslatedText(lang, 'setlog.REMOVE_SUCCESS', { logType: logType }),
                flags: [MessageFlags.Ephemeral] // Korrektur: ephemeral: true durch flags ersetzen
            });
        }
    },
};
