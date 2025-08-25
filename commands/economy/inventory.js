// commands/economy/inventory.js — ESM-Version
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { loadEconomy, getUserData } from '../../utils/economyUtils.js';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('Zeigt dein Inventar oder das Inventar eines anderen Benutzers an.')
    .setDescriptionLocalizations({
      de: getTranslatedText('de', 'inventory_command.DESCRIPTION'),
      'en-US': getTranslatedText('en', 'inventory_command.DESCRIPTION'),
    })
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Der Benutzer, dessen Inventar du sehen möchtest.')
        .setDescriptionLocalizations({
          de: getTranslatedText('de', 'inventory_command.USER_OPTION_DESCRIPTION'),
          'en-US': getTranslatedText('en', 'inventory_command.USER_OPTION_DESCRIPTION'),
        })
        .setRequired(false),
    ),

  category: 'Economy',

  async execute(interaction) {
    const lang = await getGuildLanguage(interaction.guildId);

    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('user') || interaction.user;
    const economyData = loadEconomy();
    const userData = getUserData(targetUser.id, economyData);

    const inventory = userData.inventory;
    const inventoryItems = Object.keys(inventory);

    let description;
    if (inventoryItems.length === 0) {
      description = getTranslatedText(lang, 'inventory_command.EMPTY_INVENTORY', { userTag: targetUser.tag });
    } else {
      description = getTranslatedText(lang, 'inventory_command.INVENTORY_LIST_HEADER') + '\n\n';
      for (const itemId of inventoryItems) {
        const quantity = inventory[itemId];
        description += `**${itemId}**: ${quantity}x\n`;
      }
    }

    const inventoryEmbed = new EmbedBuilder()
      .setColor(0x7289da)
      .setTitle(getTranslatedText(lang, 'inventory_command.EMBED_TITLE', { userTag: targetUser.tag }))
      .setDescription(description)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setTimestamp()
      .setFooter({ text: getTranslatedText(lang, 'economy_system.FOOTER') });

    await interaction.editReply({ embeds: [inventoryEmbed] });
  },
};