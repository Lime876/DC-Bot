// commands/moderation/ban.js — ESM-Version
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

// Parser für z. B. "1h30m", "2d5h", "45m"
function parseDuration(input) {
  const regex = /(\d+)\s*(d|h|m)/gi;
  let match;
  let totalMs = 0;

  while ((match = regex.exec(input)) !== null) {
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    if (unit === 'm') totalMs += value * 60 * 1000;
    else if (unit === 'h') totalMs += value * 60 * 60 * 1000;
    else if (unit === 'd') totalMs += value * 24 * 60 * 60 * 1000;
  }

  return totalMs > 0 ? totalMs : null;
}

export default {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannt einen Benutzer (optional temporär, z. B. 10m, 2h, 1h30m)')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Der zu bannende Benutzer')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('grund')
        .setDescription('Grund für den Ban')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('dauer')
        .setDescription('Dauer (optional) z. B. 10m, 2h, 1h30m')
        .setRequired(false) // Dauer jetzt optional
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  category: 'Moderation',

  async execute(interaction) {
    const lang = await getGuildLanguage(interaction.guildId);
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('grund');
    const durationInput = interaction.options.getString('dauer');

    let durationMs = null;
    if (durationInput) {
      durationMs = parseDuration(durationInput);
      if (!durationMs) {
        return interaction.editReply({
          content: `❌ Ungültiges Zeitformat. Beispiel: \`10m\`, \`2h\`, \`1h30m\`, \`3d2h15m\``
        });
      }
    }

    const targetMember =
      interaction.guild.members.cache.get(targetUser.id) ||
      (await interaction.guild.members.fetch(targetUser.id).catch(() => null));

    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.editReply({
        content: getTranslatedText(lang, 'ban_command.NO_PERMISSION_BOT'),
      });
    }

    if (targetUser.id === interaction.user.id) {
      return interaction.editReply({
        content: getTranslatedText(lang, 'ban_command.CANNOT_BAN_SELF'),
      });
    }

    if (targetUser.bot) {
      return interaction.editReply({
        content: getTranslatedText(lang, 'ban_command.CANNOT_BAN_BOT'),
      });
    }

    if (!targetMember) {
      return interaction.editReply({
        content: getTranslatedText(lang, 'ban_command.USER_NOT_ON_SERVER'),
      });
    }

    if (!targetMember.bannable) {
      return interaction.editReply({
        content: getTranslatedText(lang, 'ban_command.CANNOT_BAN_HIGHER'),
      });
    }

    try {
      await targetMember.ban({ reason });

      const banInfo = durationInput
        ? `für ${durationInput}`
        : `permanent`;
      await interaction.editReply({
        content: `✅ ${targetUser.tag} wurde ${banInfo} gebannt.\nGrund: ${reason}`,
      });

      logger.info(`[Ban] ${targetUser.tag} gebannt (${banInfo}). Grund: ${reason}`);

      // Falls Dauer angegeben → automatisches Unban planen
      if (durationMs) {
        setTimeout(async () => {
          try {
            await interaction.guild.members.unban(targetUser.id, 'Automatisches Ende des temporären Bans');
            logger.info(`[Ban] ${targetUser.tag} automatisch entbannt.`);
          } catch (error) {
            logger.error(`Fehler beim automatischen Entbannen von ${targetUser.tag}:`, error);
          }
        }, durationMs);
      }
    } catch (error) {
      logger.error(`[Ban] Fehler beim Bannen von ${targetUser.tag}:`, error);
      await interaction.editReply({
        content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'),
      });
    }
  },
};