// events/ticketSystem.js
const {
    Events,
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getGuildLanguage, getTranslatedText } = require('../utils/languageUtils');
const logger = require('../utils/logger');

const configPath = path.join(__dirname, '../data/reactionSetupConfig.json');

// Konfig laden
const loadConfig = () => {
    if (fs.existsSync(configPath)) {
        try {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (e) {
            logger.error(`[TicketSystem] Fehler beim Parsen von ${configPath}:`, e);
            return {};
        }
    }
    return {};
};

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.isButton()) return;

        const guildId = interaction.guild.id;
        const lang = await getGuildLanguage(guildId);
        const config = loadConfig()[guildId];

        // === OPEN TICKET ===
        if (interaction.customId === 'open_ticket') {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ ephemeral: true }).catch(err =>
                    logger.error(`[TicketSystem] Fehler beim DeferReply für open_ticket:`, err)
                );
            }

            if (!config || !config.ticketCategoryId || !config.supportRoleId || !config.transcriptChannelId) {
                logger.warn(`[TicketSystem] Ticket-System nicht vollständig konfiguriert für Gilde ${guildId}.`);
                await interaction.editReply({
                    content: getTranslatedText(lang, 'ticket_system.NOT_CONFIGURED_ERROR'),
                    ephemeral: true
                }).catch(err => logger.error(`[TicketSystem] Fehler beim editReply:`, err));
                return;
            }

            const ticketCategory = interaction.guild.channels.cache.get(config.ticketCategoryId);
            const supportRole = interaction.guild.roles.cache.get(config.supportRoleId);

            if (!ticketCategory || ticketCategory.type !== ChannelType.GuildCategory) {
                return interaction.editReply({
                    content: getTranslatedText(lang, 'ticket_system.INVALID_CATEGORY_ERROR'),
                    ephemeral: true
                }).catch(err => logger.error(`[TicketSystem] Fehler beim editReply:`, err));
            }

            if (!supportRole) {
                return interaction.editReply({
                    content: getTranslatedText(lang, 'ticket_system.INVALID_SUPPORT_ROLE_ERROR'),
                    ephemeral: true
                }).catch(err => logger.error(`[TicketSystem] Fehler beim editReply:`, err));
            }

            const existingTicket = interaction.guild.channels.cache.find(c =>
                c.name === `ticket-${interaction.user.id}` && c.parentId === ticketCategory.id
            );

            if (existingTicket) {
                return interaction.editReply({
                    content: getTranslatedText(lang, 'ticket_system.ALREADY_OPEN_ERROR', {
                        channelMention: existingTicket.toString()
                    }),
                    ephemeral: true
                }).catch(err => logger.error(`[TicketSystem] Fehler beim editReply:`, err));
            }

            try {
                const ticketChannel = await interaction.guild.channels.create({
                    name: `ticket-${interaction.user.username.toLowerCase().replace(/\s/g, '-')}`,
                    type: ChannelType.GuildText,
                    parent: ticketCategory.id,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.id,
                            deny: [PermissionFlagsBits.ViewChannel],
                        },
                        {
                            id: interaction.user.id,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.ReadMessageHistory,
                            ],
                        },
                        {
                            id: supportRole.id,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.ReadMessageHistory,
                            ],
                        },
                    ],
                });

                logger.info(`[TicketSystem] Ticket-Kanal ${ticketChannel.name} erstellt.`);

                const welcomeEmbed = new EmbedBuilder()
                    .setColor('Blue')
                    .setTitle(config.ticketEmbedTitle || getTranslatedText(lang, 'ticket_system.DEFAULT_WELCOME_TITLE'))
                    .setDescription(config.ticketEmbedDescription || getTranslatedText(lang, 'ticket_system.DEFAULT_WELCOME_DESCRIPTION', {
                        userMention: interaction.user.toString(),
                        supportRoleMention: supportRole.toString()
                    }))
                    .setTimestamp();

                const closeButton = new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel(getTranslatedText(lang, 'buttons.BUTTON_CLOSE_TICKET'))
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒');

                const claimButton = new ButtonBuilder()
                    .setCustomId('claim_ticket')
                    .setLabel(getTranslatedText(lang, 'buttons.BUTTON_CLAIM_TICKET'))
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🙋');

                const row = new ActionRowBuilder().addComponents(closeButton, claimButton);

                await ticketChannel.send({
                    content: `${interaction.user.toString()} <@&${supportRole.id}>`,
                    embeds: [welcomeEmbed],
                    components: [row]
                });

                await interaction.editReply({
                    content: getTranslatedText(lang, 'ticket_system.TICKET_CREATED_SUCCESS', {
                        channelMention: ticketChannel.toString()
                    }),
                    ephemeral: true
                });

            } catch (error) {
                logger.error(`[TicketSystem] Fehler beim Erstellen des Tickets:`, error);
                await interaction.editReply({
                    content: getTranslatedText(lang, 'ticket_system.CREATION_FAILED_ERROR'),
                    ephemeral: true
                }).catch(() => {});
            }
        }

        // === CLOSE TICKET ===
        else if (interaction.customId === 'close_ticket') {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ ephemeral: true }).catch(() => {});
            }

            const config = loadConfig()[guildId];
            const transcriptChannel = interaction.guild.channels.cache.get(config.transcriptChannelId);

            if (!transcriptChannel || transcriptChannel.type !== ChannelType.GuildText) {
                return interaction.editReply({
                    content: getTranslatedText(lang, 'ticket_system.CLOSE_FAILED_INVALID_LOG_CHANNEL'),
                    ephemeral: true
                }).catch(() => {});
            }

            try {
                const channelName = interaction.channel.name;
                const channelId = interaction.channel.id;

                await interaction.editReply({
                    content: getTranslatedText(lang, 'ticket_system.CLOSING_TICKET_MESSAGE'),
                    ephemeral: true
                });

                const messages = await interaction.channel.messages.fetch({ limit: 100 });
                const transcript = messages.reverse().map(m => `${m.author.tag}: ${m.cleanContent}`).join('\n');

                const transcriptEmbed = new EmbedBuilder()
                    .setColor('Orange')
                    .setTitle(getTranslatedText(lang, 'ticket_system.TRANSCRIPT_TITLE', { channelName }))
                    .setDescription(`**User ID:** ${interaction.user.id}\n**Channel ID:** ${channelId}\n\n\`\`\`\n${transcript}\n\`\`\``)
                    .setTimestamp();

                await transcriptChannel.send({ embeds: [transcriptEmbed] });
                await interaction.channel.delete(getTranslatedText(lang, 'ticket_system.CHANNEL_DELETE_REASON', {
                    userTag: interaction.user.tag
                }));

                logger.info(`[TicketSystem] Ticket ${channelName} gelöscht und Transkript gesendet.`);
            } catch (error) {
                logger.error(`[TicketSystem] Fehler beim Schließen:`, error);
                await interaction.editReply({
                    content: getTranslatedText(lang, 'ticket_system.CLOSE_FAILED_GENERIC_ERROR'),
                    ephemeral: true
                }).catch(() => {});
            }
        }

        // === CLAIM TICKET ===
        else if (interaction.customId === 'claim_ticket') {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ ephemeral: true }).catch(() => {});
            }

            const supportRole = interaction.guild.roles.cache.get(config.supportRoleId);
            if (!supportRole || !interaction.member.roles.cache.has(supportRole.id)) {
                return interaction.editReply({
                    content: getTranslatedText(lang, 'ticket_system.CLAIM_FAILED_NO_PERMISSION'),
                    ephemeral: true
                }).catch(() => {});
            }

            try {
                await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                });

                await interaction.channel.send({
                    content: getTranslatedText(lang, 'ticket_system.TICKET_CLAIMED_SUCCESS', {
                        userMention: interaction.user.toString()
                    })
                });

                await interaction.editReply({
                    content: getTranslatedText(lang, 'ticket_system.CLAIM_SUCCESS_EPHEMERAL'),
                    ephemeral: true
                });

                logger.info(`[TicketSystem] Ticket ${interaction.channel.name} von ${interaction.user.tag} beansprucht.`);
            } catch (error) {
                logger.error(`[TicketSystem] Fehler beim Beanspruchen:`, error);
                await interaction.editReply({
                    content: getTranslatedText(lang, 'ticket_system.CLAIM_FAILED_GENERIC_ERROR'),
                    ephemeral: true
                }).catch(() => {});
            }
        }
    }
};
