// commands/General/help.js
const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    EmbedBuilder,
    MessageFlags,
    ComponentType,
} = require('discord.js');
const { getGuildLanguage, getTranslatedText } = require('../../utils/languageUtils');
const logger = require('../../utils/logger'); // Stelle sicher, dass der Logger korrekt importiert und konfiguriert ist

const activeHelpSessions = new Map();

const getCommandCategories = (commands) => {
    // Convert commands to array if it's a Collection
    const cmds = Array.isArray(commands) ? commands : Array.from(commands.values());
    const categories = new Set();
    cmds.forEach(command => {
        if (command.category) {
            categories.add(command.category);
        }
    });
    return Array.from(categories).sort();
};

const filterVisibleCommands = (commands, member) => {
    // Convert commands to array if it's a Collection
    const cmds = Array.isArray(commands) ? commands : Array.from(commands.values());
    return cmds.filter(cmd => {
        if (!cmd.permissions) return true;
        return member.permissions.has(cmd.permissions);
    });
};

const getHelpEmbed = (selectedCategory, lang, commands, member) => {
    // Convert commands to array if it's a Collection
    const cmds = Array.isArray(commands) ? commands : Array.from(commands.values());
    const embed = new EmbedBuilder()
        .setColor('Blue')
        .setTimestamp();

    const visibleCommands = filterVisibleCommands(cmds, member);

    if (selectedCategory === 'overview') {
        embed.setTitle(getTranslatedText(lang, 'help_command.GENERAL_OVERVIEW_TITLE'))
             .setDescription(getTranslatedText(lang, 'help_command.GENERAL_OVERVIEW_DESCRIPTION'));
    } else {
        embed.setTitle(getTranslatedText(lang, 'help_command.CATEGORY_TITLE', { category: selectedCategory }))
             .setDescription(getTranslatedText(lang, 'help_command.CATEGORY_DESCRIPTION', { category: selectedCategory }));

        const commandsInCategory = visibleCommands.filter(cmd => cmd.category === selectedCategory);

        if (commandsInCategory.length > 0) {
            let descriptionText = '';
            commandsInCategory.forEach(cmd => {
                const cmdDescription = getTranslatedText(lang, `${cmd.data.name}_command.DESCRIPTION`) || cmd.data.description || getTranslatedText(lang, 'help_command.NO_DESCRIPTION');
                descriptionText += `**\`/${cmd.data.name}\`**\n${cmdDescription}\n\n`;
            });
            embed.setDescription(descriptionText);
        } else {
            embed.setDescription(getTranslatedText(lang, 'help_command.NO_COMMANDS_IN_CATEGORY'));
        }
    }

    embed.setFooter({
        text: getTranslatedText(lang, 'help_command.FOOTER_SELECT_HINT')
    });

    return embed;
};

const getSelectMenuRow = (selectedCategory, lang, commands, member) => {
    // Convert commands to array if it's a Collection
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
        ...categories.map(cat => {
            // HIER IST DER NEUE DEBUG-LOG!
            logger.debug(`[Help Command] Verarbeite Kategorie für Auswahlmenü: ${cat}, in Kleinbuchstaben: ${cat.toLowerCase()}`);
            return {
                label: cat,
                description: getTranslatedText(lang, `help_command.${cat.toLowerCase()}_category_description`) || getTranslatedText(lang, 'help_command.DEFAULT_CATEGORY_DESCRIPTION'),
                value: cat,
                default: cat === selectedCategory,
            };
        })
    ];

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('help_select_menu')
        .setPlaceholder(getTranslatedText(lang, 'help_command.SELECT_MENU_PLACEHOLDER'))
        .addOptions(options);

    return new ActionRowBuilder().addComponents(selectMenu);
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Displays a list of commands.')
        .setDescriptionLocalizations({
            de: getTranslatedText('de', 'help_command.DESCRIPTION'),
            'en-US': getTranslatedText('en', 'help_command.DESCRIPTION')
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
                ephemeral: true 
            });

            activeHelpSessions.set(message.id, {
                userId,
                selectedCategory
            });

            const collector = interaction.channel.createMessageComponentCollector({
                filter: i => i.user.id === userId && i.message.id === message.id && i.customId === 'help_select_menu',
                componentType: ComponentType.StringSelect,
                time: 300000
            });

            collector.on('collect', async i => {
                const currentSession = activeHelpSessions.get(i.message.id);

                try {
                    if (!i.deferred && !i.replied) {
                        await i.deferUpdate();
                    }
                } catch (err) {
                    if (err.code !== 10062) logger.error("Fehler bei deferUpdate:", err);
                    return;
                }

                if (!currentSession || currentSession.userId !== i.user.id) return;

                try {
                    currentSession.selectedCategory = i.values[0];
                    const updatedEmbed = getHelpEmbed(currentSession.selectedCategory, lang, client.commands, member);
                    const updatedRow = getSelectMenuRow(currentSession.selectedCategory, lang, client.commands, member);

                    await i.editReply({
                        embeds: [updatedEmbed],
                        components: [updatedRow]
                    });
                } catch (err) {
                    logger.error("Fehler beim Bearbeiten der Hilfeantwort:", err);
                }
            });

            collector.on('end', async (_, reason) => {
                if (reason !== 'time') return;
                const session = activeHelpSessions.get(message.id);
                if (!session) return;

                const disabledRow = getSelectMenuRow(session.selectedCategory, lang, client.commands, member);
                disabledRow.components.forEach(comp => comp.setDisabled(true));

                try {
                    await message.edit({ components: [disabledRow] });
                } catch (err) {
                    if (err.code !== 10008) logger.error("Fehler beim Entfernen der Komponenten:", err);
                }

                activeHelpSessions.delete(message.id);
            });
        } catch (err) {
            logger.error("Fehler bei /help:", err);
            const msg = { content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'), ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(msg).catch(() => {});
            } else {
                await interaction.reply(msg).catch(() => {});
            }
        }
    },
};
