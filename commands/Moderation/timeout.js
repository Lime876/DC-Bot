import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

export const data = new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Gibt einem Benutzer einen Timeout (Stummschaltung)')
    .setDescriptionLocalizations({
        de: getTranslatedText('de', 'timeout_command.DESCRIPTION'),
        'en-US': getTranslatedText('en', 'timeout_command.DESCRIPTION'),
    })
    .addUserOption(option =>
        option.setName('user')
            .setDescription('Der Benutzer, der getimeoutet werden soll')
            .setDescriptionLocalizations({
                de: getTranslatedText('de', 'timeout_command.USER_OPTION_DESCRIPTION'),
                'en-US': getTranslatedText('en', 'timeout_command.USER_OPTION_DESCRIPTION'),
            })
            .setRequired(true))
    .addIntegerOption(option =>
        option.setName('dauer')
            .setDescription('Dauer des Timeouts in Minuten (max. 40320 = 28 Tage)')
            .setDescriptionLocalizations({
                de: getTranslatedText('de', 'timeout_command.DURATION_OPTION_DESCRIPTION'),
                'en-US': getTranslatedText('en', 'timeout_command.DURATION_OPTION_DESCRIPTION'),
            })
            .setMinValue(1)
            .setMaxValue(40320)
            .setRequired(true))
    .addStringOption(option =>
        option.setName('grund')
            .setDescription('Grund für den Timeout')
            .setDescriptionLocalizations({
                de: getTranslatedText('de', 'timeout_command.REASON_OPTION_DESCRIPTION'),
                'en-US': getTranslatedText('en', 'timeout_command.REASON_OPTION_DESCRIPTION'),
            })
            .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export const category = 'Moderation';

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser('user');
    const dauer = interaction.options.getInteger('dauer');
    const lang = await getGuildLanguage(interaction.guild.id);
    const grund = interaction.options.getString('grund') || getTranslatedText(lang, 'timeout_command.NO_REASON_PROVIDED');
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
        return interaction.editReply({ content: getTranslatedText(lang, 'timeout_command.USER_NOT_FOUND'), ephemeral: true });
    }

    if (!member.moderatable) {
        return interaction.editReply({ content: getTranslatedText(lang, 'timeout_command.CANNOT_TIMEOUT_USER'), ephemeral: true });
    }

    const timeoutMs = dauer * 60 * 1000;

    try {
        await member.timeout(timeoutMs, grund);

        const embed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle(getTranslatedText(lang, 'timeout_command.EMBED_TITLE'))
            .addFields(
                { name: getTranslatedText(lang, 'timeout_command.EMBED_FIELD_USER'), value: `${user.tag} (\`${user.id}\`)`, inline: true },
                { name: getTranslatedText(lang, 'timeout_command.EMBED_FIELD_DURATION'), value: `${dauer} ${getTranslatedText(lang, 'timeout_command.MINUTES')}`, inline: true },
                { name: getTranslatedText(lang, 'timeout_command.EMBED_FIELD_REASON'), value: grund, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() });

        await interaction.editReply({ embeds: [embed] });
        logger.info(`[Timeout Command] Benutzer ${user.tag} (${user.id}) in Gilde ${interaction.guild.name} (${interaction.guild.id}) für ${dauer} Minuten getimeoutet. Grund: ${grund}. (PID: ${process.pid})`);

    } catch (error) {
        logger.error(`[Timeout Command] Fehler beim Timeout von Benutzer ${user.id} in Gilde ${interaction.guild.id}:`, error);

        if (error.code === 50013) {
            await interaction.editReply({ content: getTranslatedText(lang, 'timeout_command.ERROR_PERMISSION_DENIED'), ephemeral: true });
        } else if (error.code === 10007) {
            await interaction.editReply({ content: getTranslatedText(lang, 'timeout_command.ERROR_MEMBER_NOT_FOUND_API'), ephemeral: true });
        } else {
            await interaction.editReply({ content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'), ephemeral: true });
        }
    }
}
