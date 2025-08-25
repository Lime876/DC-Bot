// events/ticketSystem.js (ESM)
import { Events, ChannelType, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { getTicketConfigForGuild } from '../utils/ticketConfig.js';
import { getGuildLanguage, getTranslatedText } from '../utils/languageUtils.js';
import logger from '../utils/logger.js';

export default {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        if (!interaction.isButton() || !interaction.guild) return;

        const { customId, guild, member, channel } = interaction;
        const lang = await getGuildLanguage(guild.id);
        const ticketConfig = getTicketConfigForGuild(guild.id);

        if (!ticketConfig) {
            if (customId === 'create_ticket') {
                return interaction.reply({
                    content: getTranslatedText(lang, 'ticket_panel_edit_command.NOT_SETUP'),
                    flags: [MessageFlags.Ephemeral]
                }).catch(err => logger.error(`[Ticket System] Fehler beim Antworten auf create_ticket (nicht eingerichtet):`, err));
            }
            return;
        }

        const { categoryId, supportRoleId, logChannelId } = ticketConfig;

        // Ticket eröffnen
        if (customId === 'create_ticket') {
            try {
                const existingTicket = guild.channels.cache.find(
                    ch => ch.type === ChannelType.GuildText &&
                          ch.parentId === categoryId &&
                          ch.name.startsWith('ticket-') &&
                          ch.topic && ch.topic.includes(`User ID: ${member.id}`)
                );

                if (existingTicket) {
                    return await interaction.reply({
                        content: getTranslatedText(lang, 'ticket_system.TICKET_ALREADY_OPEN', { channelMention: existingTicket.toString() }),
                        flags: [MessageFlags.Ephemeral]
                    });
                }

                const ticketChannel = await guild.channels.create({
                    name: `ticket-${member.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '')}`,
                    type: ChannelType.GuildText,
                    parent: categoryId,
                    topic: `Ticket für ${member.user.tag} | User ID: ${member.id}`,
                    permissionOverwrites: [
                        { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                        { id: supportRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                        { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels] }
                    ]
                });

                const ticketEmbed = new EmbedBuilder()
                    .setColor(0x0099ff)
                    .setTitle(getTranslatedText(lang, 'ticket_system.TICKET_WELCOME_TITLE', { userTag: member.user.tag }))
                    .setDescription(getTranslatedText(lang, 'ticket_system.TICKET_WELCOME_DESCRIPTION', { userMention: member.toString() }));

                const closeButton = new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel(getTranslatedText(lang, 'buttons.BUTTON_CLOSE_TICKET'))
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒');

                const claimButton = new ButtonBuilder()
                    .setCustomId('claim_ticket')
                    .setLabel(getTranslatedText(lang, 'buttons.BUTTON_CLAIM_TICKET'))
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🙋');

                const ticketActionRow = new ActionRowBuilder().addComponents(closeButton, claimButton);

                await ticketChannel.send({ content: `<@${member.id}> <@&${supportRoleId}>`, embeds: [ticketEmbed], components: [ticketActionRow] });

                await interaction.reply({ content: getTranslatedText(lang, 'ticket_system.TICKET_CREATED_SUCCESS') + ` ${ticketChannel.toString()}`, flags: [MessageFlags.Ephemeral] });

                const logChannel = guild.channels.cache.get(logChannelId);
                if (logChannel?.isTextBased()) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle(getTranslatedText(lang, 'ticket_system.LOG_TICKET_CREATED_TITLE'))
                        .setDescription(getTranslatedText(lang, 'ticket_system.LOG_TICKET_CREATED_DESCRIPTION', { userTag: member.user.tag, userId: member.id }))
                        .addFields(
                            { name: getTranslatedText(lang, 'ticket_system.LOG_FIELD_TICKET_CHANNEL'), value: ticketChannel.toString(), inline: true },
                            { name: getTranslatedText(lang, 'ticket_system.LOG_FIELD_CREATOR'), value: `${member.user.tag} (${member.id})`, inline: true }
                        )
                        .setColor(0x57F287)
                        .setTimestamp();
                    await logChannel.send({ embeds: [logEmbed] });
                }

                logger.info(`[Ticket System] Ticket von ${member.user.tag} in Gilde ${guild.id} erstellt: ${ticketChannel.name}. (PID: ${process.pid})`);

            } catch (error) {
                logger.error(`[Ticket System] Fehler beim Erstellen des Tickets für ${member.user.tag} in Gilde ${guild.id}:`, error);
                await interaction.reply({ content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'), flags: [MessageFlags.Ephemeral] });
            }
        }

        // Ticket schließen
        else if (customId === 'close_ticket') {
            if (channel.parentId !== categoryId || !channel.name.startsWith('ticket-')) {
                return interaction.reply({ content: getTranslatedText(lang, 'ticket_system.NOT_A_TICKET_CHANNEL'), flags: [MessageFlags.Ephemeral] });
            }

            const ticketCreatorIdMatch = channel.topic?.match(/User ID: (\d+)/);
            const ticketCreatorId = ticketCreatorIdMatch?.[1];

            if (member.id !== ticketCreatorId && !member.roles.cache.has(supportRoleId)) {
                return interaction.reply({ content: getTranslatedText(lang, 'ticket_system.CLOSE_FAILED_NO_PERMISSION'), flags: [MessageFlags.Ephemeral] });
            }

            await interaction.deferReply({ ephemeral: true });

            try {
                await interaction.followUp({ content: getTranslatedText(lang, 'ticket_system.CLOSING_TICKET_MESSAGE'), flags: [MessageFlags.Ephemeral] });
                await new Promise(resolve => setTimeout(resolve, 3000));

                const channelName = channel.name;
                const channelId = channel.id;
                await channel.delete({ reason: getTranslatedText(lang, 'ticket_system.CHANNEL_DELETE_REASON') });

                const logChannel = guild.channels.cache.get(logChannelId);
                if (logChannel?.isTextBased()) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle(getTranslatedText(lang, 'ticket_system.LOG_TICKET_CLOSED_TITLE'))
                        .setDescription(getTranslatedText(lang, 'ticket_system.LOG_TICKET_CLOSED_DESCRIPTION', { channelName, channelId, userTag: member.user.tag, userId: member.id }))
                        .setColor(0xED4245)
                        .setTimestamp();
                    await logChannel.send({ embeds: [logEmbed] });
                }

                logger.info(`[Ticket System] Ticket ${channelName} in Gilde ${guild.id} von ${member.user.tag} geschlossen. (PID: ${process.pid})`);
            } catch (error) {
                logger.error(`[Ticket System] Fehler beim Schließen des Tickets ${channel.name} in Gilde ${guild.id}:`, error);
                await interaction.followUp({ content: getTranslatedText(lang, 'ticket_system.CLOSE_FAILED_GENERIC_ERROR'), flags: [MessageFlags.Ephemeral] });
            }
        }

        // Ticket übernehmen
        else if (customId === 'claim_ticket') {
            if (!member.roles.cache.has(supportRoleId)) {
                return interaction.reply({ content: getTranslatedText(lang, 'ticket_system.CLAIM_FAILED_NO_PERMISSION'), flags: [MessageFlags.Ephemeral] });
            }

            const currentEmbed = interaction.message.embeds[0];
            if (currentEmbed?.footer?.text?.startsWith(getTranslatedText(lang, 'ticket_system.TICKET_CLAIMED_FOOTER_PREFIX'))) {
                return interaction.reply({ content: getTranslatedText(lang, 'ticket_system.TICKET_ALREADY_CLAIMED'), flags: [MessageFlags.Ephemeral] });
            }

            await interaction.deferUpdate();

            try {
                const updatedEmbed = EmbedBuilder.from(currentEmbed).setFooter({ text: getTranslatedText(lang, 'ticket_system.TICKET_CLAIMED_FOOTER', { userTag: member.user.tag }) }).setColor(0xFEE75C);

                const updatedComponents = ActionRowBuilder.from(interaction.message.components[0]).setComponents(
                    ButtonBuilder.from(interaction.message.components[0].components[0]),
                    ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true)
                );

                await interaction.message.edit({ embeds: [updatedEmbed], components: [updatedComponents] });

                await interaction.followUp({ content: getTranslatedText(lang, 'ticket_system.TICKET_CLAIMED_SUCCESS', { userTag: member.user.tag }), flags: [MessageFlags.Ephemeral] });

                const logChannel = guild.channels.cache.get(logChannelId);
                if (logChannel?.isTextBased()) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle(getTranslatedText(lang, 'ticket_system.LOG_TICKET_CLAIMED_TITLE'))
                        .setDescription(getTranslatedText(lang, 'ticket_system.LOG_TICKET_CLAIMED_DESCRIPTION', { channelName: channel.name, channelId: channel.id, userTag: member.user.tag, userId: member.id }))
                        .addFields(
                            { name: getTranslatedText(lang, 'ticket_system.LOG_FIELD_TICKET_CHANNEL'), value: channel.toString(), inline: true },
                            { name: getTranslatedText(lang, 'ticket_system.LOG_FIELD_CLAIMED_BY'), value: `${member.user.tag} (${member.id})`, inline: true }
                        )
                        .setColor(0xFEE75C)
                        .setTimestamp();
                    await logChannel.send({ embeds: [logEmbed] });
                }

                logger.info(`[Ticket System] Ticket ${channel.name} in Gilde ${guild.id} von ${member.user.tag} beansprucht. (PID: ${process.pid})`);
            } catch (error) {
                logger.error(`[Ticket System] Fehler beim Beanspruchen des Tickets für ${member.user.tag} in Gilde ${guild.id}:`, error);
                await interaction.followUp({ content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'), flags: [MessageFlags.Ephemeral] });
            }
        }
    }
};