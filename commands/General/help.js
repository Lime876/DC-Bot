// commands/General/help.js — ESM-Version
import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ComponentType,
} from 'discord.js';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

const activeHelpSessions = new Map();

const getCommandCategories = (commands) => {
  const cmds = Array.isArray(commands) ? commands : Array.from(commands.values());
  const categories = new Set();
  cmds.forEach((command) => {
    if (command.category) {
      categories.add(command.category);
    }
  });
  return Array.from(categories).sort();
};

const filterVisibleCommands = (commands, member) => {
  const cmds = Array.isArray(commands) ? commands : Array.from(commands.values());
  return cmds.filter((cmd) => {
    if (!cmd.permissions) return true;
    return member.permissions.has(cmd.permissions);
  });
};

const getHelpEmbed = (selectedCategory, lang, commands, member) => {
  const cmds = Array.isArray(commands) ? commands : Array.from(commands.values());
  const embed = new EmbedBuilder().setColor('Blue').setTimestamp();

  const visibleCommands = filterVisibleCommands(cmds, member);

  if (selectedCategory === 'overview') {
    embed
      .setTitle(getTranslatedText(lang, 'help_command.GENERAL_OVERVIEW_TITLE'))
      .setDescription(getTranslatedText(lang, 'help_command.GENERAL_OVERVIEW_DESCRIPTION'));
  } else {
    const categoryDisplayName =
      getTranslatedText(lang, `help_command.category_display_names.${selectedCategory.toLowerCase()}`) ||
      selectedCategory;

    embed
      .setTitle(getTranslatedText(lang, 'help_command.CATEGORY_TITLE', { category: categoryDisplayName }))
      .setDescription(
        getTranslatedText(lang, 'help_command.CATEGORY_DESCRIPTION', { category: categoryDisplayName }),
      );

    const commandsInCategory = visibleCommands.filter((cmd) => cmd.category === selectedCategory);

    if (commandsInCategory.length > 0) {
      let descriptionText = '';
      commandsInCategory.forEach((cmd) => {
        const cmdDescription =
          getTranslatedText(lang, `${cmd.data.name}_command.DESCRIPTION`) ||
          cmd.data.description ||
          getTranslatedText(lang, 'help_command.NO_DESCRIPTION_PROVIDED');
        descriptionText += `**\`/${cmd.data.name}\`**\n${cmdDescription}\n\n`;
      });
      embed.setDescription(descriptionText);
    } else {
      embed.setDescription(getTranslatedText(lang, 'help_command.NO_COMMANDS_IN_CATEGORY'));
    }
  }

  embed.setFooter({
    text: getTranslatedText(lang, 'help_command.FOOTER_SELECT_HINT'),
  });

  return embed;
};

const getSelectMenuRow = (selectedCategory, lang, commands, member) => {
  const cmds = Array.isArray(commands) ? commands : Array.from(commands.values());
  const visibleCommands = filterVisibleCommands(cmds, member);
  const categories = getCommandCategories(visibleCommands);

  const options = [
    {
      label: getTranslatedText(lang, 'help_command.GENERAL_OVERVIEW_TITLE'),
      description: getTranslatedText(lang, 'help_command.GENERAL_OVERVIEW_SHORT_DESCRIPTION'),
      value: 'overview',
      default: selectedCategory === 'overview',
    },
    ...categories.map((cat) => {
      const categoryDescriptionKey = `help_command.${cat.toLowerCase()}_category_description`;
      const categoryDisplayNameKey = `help_command.category_display_names.${cat.toLowerCase()}`;

      const label = getTranslatedText(lang, categoryDisplayNameKey) || cat;
      const description =
        getTranslatedText(lang, categoryDescriptionKey) ||
        getTranslatedText(lang, 'help_command.DEFAULT_CATEGORY_DESCRIPTION');

      return {
        label,
        description,
        value: cat,
        default: cat === selectedCategory,
      };
    }),
  ];

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('help_select_menu')
    .setPlaceholder(getTranslatedText(lang, 'help_command.SELECT_MENU_PLACEHOLDER'))
    .addOptions(options);

  return new ActionRowBuilder().addComponents(selectMenu);
};

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Displays a list of commands.')
    .setDescriptionLocalizations({
      de: getTranslatedText('de', 'help_command.DESCRIPTION'),
      'en-US': getTranslatedText('en', 'help_command.DESCRIPTION'),
    }),

  category: 'General',

  async execute(interaction, client) {
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const lang = await getGuildLanguage(guildId);
    const member = interaction.member;
    let selectedCategory = 'overview';

    const initialEmbed = getHelpEmbed(selectedCategory, lang, client.commands, member);
    const initialRow = getSelectMenuRow(selectedCategory, lang, client.commands, member);

    try {
      const message = await interaction.reply({
        embeds: [initialEmbed],
        components: [initialRow],
        fetchReply: true,
        ephemeral: true,
      });

      activeHelpSessions.set(message.id, {
        userId,
        selectedCategory,
      });

      // Collector direkt am Message-Objekt (sicher für ephemere Nachrichten)
      const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === userId && i.customId === 'help_select_menu',
        componentType: ComponentType.StringSelect,
        time: 300000, // 5 Minuten
      });

      collector.on('collect', async (i) => {
        const currentSession = activeHelpSessions.get(message.id);

        try {
          if (!i.deferred && !i.replied) {
            await i.deferUpdate();
          }
        } catch (err) {
          if (err.code !== 10062) logger.error('[Help Command] Fehler bei deferUpdate:', err);
          return;
        }

        if (!currentSession || currentSession.userId !== i.user.id) return;

        try {
          currentSession.selectedCategory = i.values[0];
          const updatedEmbed = getHelpEmbed(currentSession.selectedCategory, lang, client.commands, member);
          const updatedRow = getSelectMenuRow(currentSession.selectedCategory, lang, client.commands, member);

          await i.editReply({
            embeds: [updatedEmbed],
            components: [updatedRow],
          });
        } catch (err) {
          logger.error('[Help Command] Fehler beim Bearbeiten der Hilfeantwort:', err);
        }
      });

      collector.on('end', async (_, reason) => {
        if (reason !== 'time') return;

        const session = activeHelpSessions.get(message.id);
        if (!session) return;

        const disabledRow = getSelectMenuRow(session.selectedCategory, lang, client.commands, member);
        disabledRow.components.forEach((comp) => comp.setDisabled(true));

        try {
          await message.edit({ components: [disabledRow] });
        } catch (err) {
          if (err.code !== 10008) logger.error('[Help Command] Fehler beim Entfernen der Komponenten:', err);
        }

        activeHelpSessions.delete(message.id);
      });
    } catch (err) {
      logger.error('[Help Command] Fehler bei /help:', err);
      const msg = {
        content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED_UNEXPECTED', { errorMessage: err.message }),
        ephemeral: true,
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg).catch(() => {});
      } else {
        await interaction.reply(msg).catch(() => {});
      }
    }
  },
};