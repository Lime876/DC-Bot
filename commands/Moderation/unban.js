import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

export const data = new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Entbannt einen Benutzer über die Benutzer-ID')
    .setDescriptionLocalizations({
        de: getTranslatedText('de', 'unban_command.DESCRIPTION'),
        'en-US': getTranslatedText('en', 'unban_command.DESCRIPTION'),
    })
    .addStringOption(option =>
        option.setName('userid')
            .setDescription('Die ID des Benutzers, der entbannt werden soll')
            .setDescriptionLocalizations({
                de: getTranslatedText('de', 'unban_command.USER_ID_OPTION_DESCRIPTION'),
                'en-US': getTranslatedText('en', 'unban_command.USER_ID_OPTION_DESCRIPTION'),
            })
            .setRequired(true))
    .addStringOption(option =>
        option.setName('grund')
            .setDescription('Grund für das Entbannen')
            .setDescriptionLocalizations({
                de: getTranslatedText('de', 'unban_command.REASON_OPTION_DESCRIPTION'),
                'en-US': getTranslatedText('en', 'unban_command.REASON_OPTION_DESCRIPTION'),
            })
            .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export const category = 'Moderation';

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.options.getString('userid');
    const lang = await getGuildLanguage(interaction.guild.id);
    const reason = interaction.options.getString('grund') || getTranslatedText(lang, 'unban_command.NO_REASON_PROVIDED');

    try {
        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
            return interaction.editReply({
                content: getTranslatedText(lang, 'unban_command.BOT_PERMISSION_DENIED'),
                ephemeral: true,
            });
        }

        const bans = await interaction.guild.bans.fetch();
        const bannedUser = bans.find(ban => ban.user.id === userId);

        if (!bannedUser) {
            return interaction.editReply({
                content: getTranslatedText(lang, 'unban_command.USER_NOT_BANNED'),
                ephemeral: true,
            });
        }

        await interaction.guild.members.unban(userId, reason);

        await interaction.editReply({
            content: getTranslatedText(lang, 'unban_command.SUCCESS', { userId, reason }),
        });

        logger.info(`[Unban Command] Benutzer mit ID ${userId} in Gilde ${interaction.guild.name} entbannt durch ${interaction.user.tag}. Grund: ${reason}. (PID: ${process.pid})`);

    } catch (error) {
        logger.error(`[Unban Command] Fehler beim Entbannen von Benutzer ID ${userId} in Gilde ${interaction.guild.id}:`, error);

        if (error.code === 10026) {
            return interaction.editReply({
                content: getTranslatedText(lang, 'unban_command.USER_NOT_BANNED'),
                ephemeral: true,
            });
        } else if (error.code === 50013) {
            return interaction.editReply({
                content: getTranslatedText(lang, 'unban_command.BOT_PERMISSION_DENIED'),
                ephemeral: true,
            });
        }

        await interaction.editReply({
            content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'),
            ephemeral: true,
        });
    }
}
