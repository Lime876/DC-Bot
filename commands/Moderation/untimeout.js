import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

export const data = new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Hebt den Timeout eines Mitglieds auf')
    .setDescriptionLocalizations({
        de: getTranslatedText('de', 'untimeout_command.DESCRIPTION'),
        'en-US': getTranslatedText('en', 'untimeout_command.DESCRIPTION'),
    })
    .addUserOption(option =>
        option.setName('mitglied')
            .setDescription('Das Mitglied, dessen Timeout aufgehoben werden soll')
            .setDescriptionLocalizations({
                de: getTranslatedText('de', 'untimeout_command.MEMBER_OPTION_DESCRIPTION'),
                'en-US': getTranslatedText('en', 'untimeout_command.MEMBER_OPTION_DESCRIPTION'),
            })
            .setRequired(true))
    .addStringOption(option =>
        option.setName('grund')
            .setDescription('Grund für das Entfernen des Timeouts')
            .setDescriptionLocalizations({
                de: getTranslatedText('de', 'untimeout_command.REASON_OPTION_DESCRIPTION'),
                'en-US': getTranslatedText('en', 'untimeout_command.REASON_OPTION_DESCRIPTION'),
            })
            .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export const category = 'Moderation';

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser('mitglied');
    const lang = await getGuildLanguage(interaction.guild.id);
    const grund = interaction.options.getString('grund') || getTranslatedText(lang, 'untimeout_command.NO_REASON_PROVIDED');
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
        return interaction.editReply({ content: getTranslatedText(lang, 'untimeout_command.MEMBER_NOT_FOUND'), ephemeral: true });
    }

    if (!member.communicationDisabledUntil) {
        return interaction.editReply({
            content: getTranslatedText(lang, 'untimeout_command.NOT_TIMED_OUT', { user: member.user.tag }),
            ephemeral: true,
        });
    }

    if (!member.moderatable) {
        return interaction.editReply({ content: getTranslatedText(lang, 'untimeout_command.CANNOT_UNTIMEOUT_USER'), ephemeral: true });
    }

    try {
        await member.timeout(null, grund);

        const embed = new EmbedBuilder()
            .setColor(0x00FFFF)
            .setTitle(getTranslatedText(lang, 'untimeout_command.EMBED_TITLE'))
            .addFields(
                { name: getTranslatedText(lang, 'untimeout_command.EMBED_FIELD_MEMBER'), value: `${member.user.tag} (\`${member.user.id}\`)`, inline: true },
                { name: getTranslatedText(lang, 'untimeout_command.EMBED_FIELD_REASON'), value: grund, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() });

        await interaction.editReply({ embeds: [embed] });
        logger.info(`[Untimeout Command] Timeout von Mitglied ${member.user.tag} (${member.user.id}) in Gilde ${interaction.guild.name} (${interaction.guild.id}) aufgehoben. Grund: ${grund}. (PID: ${process.pid})`);

    } catch (error) {
        logger.error(`[Untimeout Command] Fehler beim Aufheben des Timeouts von Mitglied ${member.user.id} in Gilde ${interaction.guild.id}:`, error);

        if (error.code === 50013) {
            await interaction.editReply({ content: getTranslatedText(lang, 'untimeout_command.ERROR_PERMISSION_DENIED'), ephemeral: true });
        } else if (error.code === 10007) {
            await interaction.editReply({ content: getTranslatedText(lang, 'untimeout_command.ERROR_MEMBER_NOT_FOUND_API'), ephemeral: true });
        } else {
            await interaction.editReply({ content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'), ephemeral: true });
        }
    }
}