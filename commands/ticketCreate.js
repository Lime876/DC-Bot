const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../../utils/logger.js');

// Helper function to sanitize channel name
function sanitizeChannelName(name) {
    return `ticket-${name.toLowerCase()
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/[^\w-]+/g, '') // Remove non-alphanumeric characters except hyphens
        .substring(0, 90)}` // Max length for channel name is 100, prefix is "ticket-", leave some room
        .replace(/--+/g, '-'); // Replace multiple hyphens with a single one
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticketcreate')
        .setDescription('Creates a new ticket and initiates the setup process.'),
    async execute(interaction) {
        let ticketTitle = '';
        let ticketDescription = '';
        let ticketCategoryId = '';

        const setTitleButton = new ButtonBuilder()
            .setCustomId('ticketSetTitleButton')
            .setLabel('Set Title')
            .setStyle(ButtonStyle.Primary);

        const initialRow = new ActionRowBuilder().addComponents(setTitleButton);

        const message = await interaction.reply({
            content: 'Ticket creation process started! Click the button to set the title.',
            components: [initialRow],
            ephemeral: true,
            fetchReply: true,
        });

        const filter = (i) =>
            i.customId === 'ticketSetTitleButton' ||
            i.customId === 'ticketTitleModal' ||
            i.customId === 'ticketSetDescriptionButton' ||
            i.customId === 'ticketDescriptionModal' ||
            i.customId === 'ticketCategorySelect';

        const collector = message.createMessageComponentCollector({ filter, time: 180000 });

        collector.on('collect', async (i) => {
            try {
                if (i.isButton()) {
                    if (i.customId === 'ticketSetTitleButton') {
                        const titleModal = new ModalBuilder().setCustomId('ticketTitleModal').setTitle('Set Ticket Title');
                        const titleInput = new TextInputBuilder().setCustomId('ticketTitleInput').setLabel('Ticket Title').setStyle(TextInputStyle.Short).setPlaceholder('Enter the title for the ticket').setRequired(true);
                        titleModal.addComponents(new ActionRowBuilder().addComponents(titleInput));
                        await i.showModal(titleModal);
                    } else if (i.customId === 'ticketSetDescriptionButton') {
                        const descriptionModal = new ModalBuilder().setCustomId('ticketDescriptionModal').setTitle('Set Ticket Description');
                        const descriptionInput = new TextInputBuilder().setCustomId('ticketDescriptionInput').setLabel('Ticket Description').setStyle(TextInputStyle.Paragraph).setPlaceholder('Enter the detailed description for the ticket').setRequired(true);
                        descriptionModal.addComponents(new ActionRowBuilder().addComponents(descriptionInput));
                        await i.showModal(descriptionModal);
                    }
                } else if (i.isModalSubmit()) {
                    if (i.customId === 'ticketTitleModal') {
                        ticketTitle = i.fields.getTextInputValue('ticketTitleInput');
                        const setDescriptionButton = new ButtonBuilder().setCustomId('ticketSetDescriptionButton').setLabel('Set Description').setStyle(ButtonStyle.Primary);
                        await i.deferUpdate();
                        await interaction.editReply({
                            content: `Title '${ticketTitle}' received. Now, please provide the description.`,
                            components: [new ActionRowBuilder().addComponents(setDescriptionButton)],
                        });
                    } else if (i.customId === 'ticketDescriptionModal') {
                        ticketDescription = i.fields.getTextInputValue('ticketDescriptionInput');
                        await i.deferUpdate();
                        const categories = interaction.guild.channels.cache.filter(channel => channel.type === ChannelType.GuildCategory);
                        if (categories.size === 0) {
                            await interaction.editReply({ content: 'No categories found. Cannot create ticket. Please create a category first.', components: [] });
                            return collector.stop('no_categories');
                        }
                        const categoryOptions = categories.map(cat => new StringSelectMenuOptionBuilder().setLabel(cat.name).setValue(cat.id).setDescription(`Create ticket in ${cat.name}`));
                        const categorySelectMenu = new StringSelectMenuBuilder().setCustomId('ticketCategorySelect').setPlaceholder('Select a category').addOptions(categoryOptions.slice(0, 25));
                        await interaction.editReply({
                            content: `Title and description received. Please select a category.\nTitle: "${ticketTitle}"\nDescription: "${ticketDescription}"`,
                            components: [new ActionRowBuilder().addComponents(categorySelectMenu)],
                        });
                    }
                } else if (i.isStringSelectMenu() && i.customId === 'ticketCategorySelect') {
                    ticketCategoryId = i.values[0];
                    const selectedCategory = interaction.guild.channels.cache.get(ticketCategoryId);
                    const categoryName = selectedCategory ? selectedCategory.name : 'Unknown Category';

                    if (!selectedCategory) {
                        await i.update({ content: 'The selected category no longer exists. Please try again.', components: [] });
                        return collector.stop('category_deleted');
                    }
                    
                    const channelName = sanitizeChannelName(ticketTitle);

                    try {
                        const newChannel = await interaction.guild.channels.create({
                            name: channelName,
                            type: ChannelType.GuildText,
                            parent: ticketCategoryId,
                            permissionOverwrites: [
                                {
                                    id: interaction.guild.roles.everyone, // @everyone role
                                    deny: [PermissionFlagsBits.ViewChannel],
                                },
                                {
                                    id: interaction.user.id, // Command user
                                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                                },
                                {
                                    id: interaction.client.user.id, // Bot
                                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageChannels], // Added ManageChannels for potential future use
                                },
                                // Add other roles like support staff here if needed
                            ],
                        });

                        const ticketEmbed = new EmbedBuilder()
                            .setColor(0x0099FF)
                            .setTitle(`Ticket: ${ticketTitle}`)
                            .setDescription(ticketDescription)
                            .addFields(
                                { name: 'Created By', value: `${interaction.user}`, inline: true },
                                { name: 'Category', value: categoryName, inline: true }
                            )
                            .setTimestamp();
                        
                        await newChannel.send({ embeds: [ticketEmbed], content: `Welcome ${interaction.user}! Support will be with you shortly.` });

                        // Log successful ticket creation
                        const logMessage = `Ticket created by ${interaction.user.tag} (ID: ${interaction.user.id}): '${ticketTitle}' (Channel: ${newChannel}, ID: ${newChannel.id}) in category '${categoryName}'.`;
                        sendLog(logMessage, 'INFO');

                        await i.update({
                            content: `Ticket channel ${newChannel} created successfully in category '${categoryName}'!`,
                            components: [],
                        });
                        collector.stop('completed_ticket_creation');

                    } catch (error) {
                        console.error('Failed to create ticket channel:', error);
                        await i.update({
                            content: 'Failed to create ticket channel. Please check my permissions and ensure the category still exists.',
                            components: [],
                        });
                        collector.stop('channel_creation_error');
                    }
                }
            } catch (error) {
                console.error('Error during ticket creation interaction:', error);
                // Ensure interaction is acknowledged before stopping collector due to error
                if (!i.replied && !i.deferred) {
                    await i.reply({ content: 'An unexpected error occurred.', ephemeral: true }).catch(console.error);
                } else {
                    await i.followUp({ content: 'An unexpected error occurred.', ephemeral: true }).catch(console.error);
                }
                collector.stop('error');
            }
        });

        collector.on('end', (collected, reason) => {
            // Final cleanup of the ephemeral message if not already updated by a success/specific error case
            if (reason === 'time') {
                interaction.editReply({ content: 'Ticket creation timed out.', components: [] }).catch(console.error);
            } else if (reason === 'error' && !interaction.replied) { // If general error stopped collector before any reply.
                interaction.editReply({ content: 'Ticket creation aborted due to an internal error.', components: [] }).catch(console.error);
            } else if (reason === 'no_categories' || reason === 'category_deleted' || reason === 'channel_creation_error') {
                // Message already handled by specific error messages
            } else if (reason !== 'completed_ticket_creation' && reason !== 'error') { // For other unexpected stops
                 interaction.editReply({ content: 'Ticket creation process was interrupted.', components: [] }).catch(console.error);
            }
             // If 'completed_ticket_creation', the message is already updated.
        });
    },
};
