// commands/admin/autorole.js — ESM-Version
import { SlashCommandBuilder, PermissionsBitField } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

// __dirname in ESM bereitstellen
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, '../../data/autoroleConfig.json');

const loadConfig = () => {
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      logger.error(`[Autorole] Fehler beim Parsen von ${configPath}:`, e);
      return {};
    }
  }
  return {};
};

const saveConfig = (config) => {
  try {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {
    logger.error(`[Autorole] Fehler beim Schreiben in ${configPath}:`, e);
  }
};

export default {
  data: new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('Manages automatic role assignment for new members.')
    .setDescriptionLocalizations({
      de: getTranslatedText('de', 'autorole_command.DESCRIPTION'),
      'en-US': getTranslatedText('en', 'autorole_command.DESCRIPTION'),
    })
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set')
        .setDescription('Sets a role for new members.')
        .setDescriptionLocalizations({
          de: getTranslatedText('de', 'autorole_command.SET_SUBCOMMAND_DESCRIPTION'),
          'en-US': getTranslatedText('en', 'autorole_command.SET_SUBCOMMAND_DESCRIPTION'),
        })
        .addRoleOption((option) =>
          option
            .setName('role')
            .setDescription('Role to assign.')
            .setDescriptionLocalizations({
              de: getTranslatedText('de', 'autorole_command.ROLE_OPTION_DESCRIPTION'),
              'en-US': getTranslatedText('en', 'autorole_command.ROLE_OPTION_DESCRIPTION'),
            })
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('Removes the autorole.')
        .setDescriptionLocalizations({
          de: getTranslatedText('de', 'autorole_command.REMOVE_SUBCOMMAND_DESCRIPTION'),
          'en-US': getTranslatedText('en', 'autorole_command.REMOVE_SUBCOMMAND_DESCRIPTION'),
        }),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('show')
        .setDescription('Displays the current autorole.')
        .setDescriptionLocalizations({
          de: getTranslatedText('de', 'autorole_command.SHOW_SUBCOMMAND_DESCRIPTION'),
          'en-US': getTranslatedText('en', 'autorole_command.SHOW_SUBCOMMAND_DESCRIPTION'),
        }),
    ),

  category: 'Admin',

  async execute(interaction) {
    const guildId = interaction.guildId;
    const lang = await getGuildLanguage(guildId);

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return interaction.reply({
        content: getTranslatedText(lang, 'permissions.MISSING_PERMISSION_SINGULAR', { permission: 'Manage Roles' }),
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();
    const config = loadConfig();
    const guildConfig = config[guildId] || {};

    if (subcommand === 'set') {
      const role = interaction.options.getRole('role');
      if (!role) {
        return interaction.reply({
          content: getTranslatedText(lang, 'role_management.ROLE_NOT_FOUND'),
          ephemeral: true,
        });
      }

      // Bot-Rollen-Hierarchie prüfen
      const botHighest = interaction.guild.members.me.roles.highest;
      if (!botHighest || botHighest.position <= role.position) {
        return interaction.reply({
          content: getTranslatedText(lang, 'autorole_command.SET_FAIL_HIERARCHY', {
            botRoleName: botHighest?.name ?? 'Bot',
            roleName: role.name,
          }),
          ephemeral: true,
        });
      }

      // Gemanagte Rollen (z. B. Integrationen) nicht setzen
      if (role.managed) {
        return interaction.reply({
          content: getTranslatedText(lang, 'autorole_command.SET_FAIL_BOT_ROLE'),
          ephemeral: true,
        });
      }

      guildConfig.autoroleId = role.id;
      config[guildId] = guildConfig;
      saveConfig(config);

      await interaction.reply({
        content:
          getTranslatedText(lang, 'autorole_command.SET_SUCCESS', { roleName: role.name }) +
          '\n' +
          getTranslatedText(lang, 'autorole_command.SET_HINT'),
        ephemeral: true,
      });
    } else if (subcommand === 'remove') {
      if (!guildConfig.autoroleId) {
        return interaction.reply({
          content: getTranslatedText(lang, 'autorole_command.REMOVE_FAIL_NO_ROLE'),
          ephemeral: true,
        });
      }

      delete guildConfig.autoroleId;
      config[guildId] = guildConfig;
      saveConfig(config);

      await interaction.reply({
        content:
          getTranslatedText(lang, 'autorole_command.REMOVE_SUCCESS') +
          '\n' +
          getTranslatedText(lang, 'autorole_command.REMOVE_HINT'),
        ephemeral: true,
      });
    } else if (subcommand === 'show') {
      if (!guildConfig.autoroleId) {
        return interaction.reply({
          content: getTranslatedText(lang, 'autorole_command.SHOW_NO_ROLE'),
          ephemeral: true,
        });
      }

      const role = interaction.guild.roles.cache.get(guildConfig.autoroleId);
      if (role) {
        await interaction.reply({
          content:
            getTranslatedText(lang, 'autorole_command.SHOW_CURRENT_ROLE', { roleName: role.name }) +
            '\n' +
            getTranslatedText(lang, 'autorole_command.SHOW_HINT'),
          ephemeral: true,
        });
      } else {
        delete guildConfig.autoroleId;
        config[guildId] = guildConfig;
        saveConfig(config);

        await interaction.reply({
          content:
            getTranslatedText(lang, 'autorole_command.SHOW_NO_ROLE') +
            ' ' +
            getTranslatedText(lang, 'autorole_command.REMOVE_SUCCESS_CLEANUP'),
          ephemeral: true,
        });
      }
    }
  },
};