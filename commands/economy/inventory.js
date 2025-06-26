// commands/economy/inventory.js (unverändert, da der Fix in economyUtils.js ist)

const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { loadEconomy, getUserData } = require('../../utils/economyUtils'); // Pfad anpassen!

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('Zeigt dein Inventar oder das Inventar eines anderen Benutzers an.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Der Benutzer, dessen Inventar du sehen möchtest.')
                .setRequired(false)),

    category: 'Wirtschaftssystem', // Oder 'Economy'

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const economyData = loadEconomy();
        const userData = getUserData(targetUser.id, economyData); 

        // Der Fix ist in getUserData, daher sollte userData.inventory hier immer ein Objekt sein.
        const inventory = userData.inventory;
        const inventoryItems = Object.keys(inventory); // Dies sollte jetzt funktionieren

        let description;
        if (inventoryItems.length === 0) {
            description = `${targetUser.tag} hat noch keine Gegenstände im Inventar.`;
        } else {
            description = 'Hier sind die Gegenstände im Inventar:\n\n';
            for (const itemId of inventoryItems) {
                const quantity = inventory[itemId];
                description += `**${itemId}**: ${quantity}x\n`;
            }
        }

        const inventoryEmbed = new EmbedBuilder()
            .setColor(0x7289DA) // Discord Blau
            .setTitle(`🎒 Inventar von ${targetUser.tag}`)
            .setDescription(description)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .setTimestamp()
            .setFooter({ text: 'Wirtschaftssystem' });

        await interaction.reply({ embeds: [inventoryEmbed] });
    },
};