// commands/invitetracker.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const inviteDataPath = path.join(__dirname, '../data/inviteData.json');
const trackerConfigPath = path.join(__dirname, '../data/trackerConfig.json');

const loadInviteData = () => {
    if (fs.existsSync(inviteDataPath)) {
        try {
            return JSON.parse(fs.readFileSync(inviteDataPath, 'utf8'));
        } catch (e) {
            console.error(`Fehler beim Parsen von ${inviteDataPath}:`, e);
            return {};
        }
    }
    return {};
};

const saveInviteData = (data) => {
    try {
        fs.writeFileSync(inviteDataPath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(`Fehler beim Schreiben in ${inviteDataPath}:`, e);
    }
};

const loadTrackerConfig = () => {
    if (fs.existsSync(trackerConfigPath)) {
        try {
            return JSON.parse(fs.readFileSync(trackerConfigPath, 'utf8'));
        } catch (e) {
            console.error(`Fehler beim Parsen von ${trackerConfigPath}:`, e);
            return {};
        }
    }
    return {};
};

const saveTrackerConfig = (config) => {
    try {
        fs.writeFileSync(trackerConfigPath, JSON.stringify(config, null, 2));
    } catch (e) {
        console.error(`Fehler beim Schreiben in ${trackerConfigPath}:`, e);
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invitetracker')
        .setDescription('Verwaltet den Invite Tracker oder zeigt Invite-Statistiken an.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Zeigt den aktuellen Status des Invite Trackers an.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('on')
                .setDescription('Aktiviert den Invite Tracker für diesen Server.')
                .addChannelOption(option =>
                    option.setName('log_kanal')
                        .setDescription('Kanal, in den Beitritts-Logs gesendet werden sollen.')
                        .addChannelTypes(0) // Nur Textkanäle
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('off')
                .setDescription('Deaktiviert den Invite Tracker für diesen Server.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('meine_invites')
                .setDescription('Zeigt an, wie viele Leute du eingeladen hast.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('nutzer_invites')
                .setDescription('Zeigt an, wie viele Leute ein bestimmter Benutzer eingeladen hat.')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Der Benutzer, dessen Invite-Statistiken angezeigt werden sollen.')
                        .setRequired(true)))
        /* Optional: Leaderboard
        .addSubcommand(subcommand =>
            subcommand
                .setName('leaderboard')
                .setDescription('Zeigt die Top-Einlader auf dem Server an.')),
        */
    , // Komma beachten, wenn du das Leaderboard entkommentierst
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        let trackerConfig = loadTrackerConfig();
        let inviteData = loadInviteData();

        if (!trackerConfig[guildId]) {
            trackerConfig[guildId] = { enabled: false, channelId: null };
            saveTrackerConfig(trackerConfig);
        }

        const isEnabled = trackerConfig[guildId].enabled;

        // Manuelle Berechtigungsprüfung für "on" und "off" Subcommands
        if (subcommand === 'on' || subcommand === 'off') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Du hast nicht die Berechtigung, den Invite Tracker zu verwalten. (Benötigt: `Manage Guild` oder `Server verwalten`)', ephemeral: true });
            }
        }

        if (subcommand === 'status') {
            const statusEmbed = new EmbedBuilder()
                .setColor(isEnabled ? 0x00FF00 : 0xFF0000)
                .setTitle('📊 Invite Tracker Status')
                .setDescription(`Der Invite Tracker ist für diesen Server **${isEnabled ? 'AKTIVIERT ✅' : 'DEAKTIVIERT ❌'}**.`)
                .setTimestamp();
            
            if (isEnabled && trackerConfig[guildId].channelId) {
                statusEmbed.addFields(
                    { name: 'Log-Kanal', value: `<#${trackerConfig[guildId].channelId}>`, inline: true }
                );
            }

            await interaction.reply({ embeds: [statusEmbed], ephemeral: true });

        } else if (subcommand === 'on') {
            if (isEnabled) {
                return interaction.reply({ content: '✅ Der Invite Tracker ist bereits aktiviert.', ephemeral: true });
            }

            const logChannel = interaction.options.getChannel('log_kanal');
            trackerConfig[guildId].enabled = true;
            trackerConfig[guildId].channelId = logChannel.id;
            saveTrackerConfig(trackerConfig);

            // Bot muss jetzt alle Invites neu cachen, um ein sauberes Starten zu gewährleisten
            try {
                await interaction.guild.invites.fetch();
                console.log(`[Invite Tracker] Invites für Server "${interaction.guild.name}" (${guildId}) neu gecacht nach Aktivierung.`);
            } catch (error) {
                console.error(`[Invite Tracker] Konnte Invites für Server ${guildId} nicht cachen:`, error);
                return interaction.reply({ content: `❌ Der Tracker wurde aktiviert, aber ich konnte die vorhandenen Invites nicht abrufen. Bitte stelle sicher, dass ich die Berechtigung 'Einladungen verwalten' habe.`, ephemeral: true });
            }

            const enableEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Invite Tracker aktiviert!')
                .setDescription(`Der Invite Tracker wurde erfolgreich aktiviert und sendet Beitritts-Logs in ${logChannel}.`)
                .setTimestamp();
            await interaction.reply({ embeds: [enableEmbed] });

        } else if (subcommand === 'off') {
            if (!isEnabled) {
                return interaction.reply({ content: '❌ Der Invite Tracker ist bereits deaktiviert.', ephemeral: true });
            }

            trackerConfig[guildId].enabled = false;
            trackerConfig[guildId].channelId = null; // Log-Kanal zurücksetzen
            saveTrackerConfig(trackerConfig);

            const disableEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Invite Tracker deaktiviert!')
                .setDescription('Der Invite Tracker wurde erfolgreich deaktiviert.')
                .setTimestamp();
            await interaction.reply({ embeds: [disableEmbed] });

        } else if (subcommand === 'meine_invites' || subcommand === 'nutzer_invites') {
            if (!isEnabled) {
                return interaction.reply({ content: '❌ Der Invite Tracker ist auf diesem Server nicht aktiviert.', ephemeral: true });
            }

            const targetUser = subcommand === 'meine_invites' ? interaction.user : interaction.options.getUser('user');
            
            const userInvites = inviteData[guildId] ? Object.values(inviteData[guildId]).filter(inv => inv.inviterId === targetUser.id) : [];

            let totalUses = 0;
            let activeInvitesCount = 0;
            userInvites.forEach(inv => {
                totalUses += inv.uses;
                if (inv.maxUses === 0 || inv.uses < inv.maxUses) { // Ist noch nicht ausgeschöpft
                    if (!inv.expiresAt || inv.expiresAt > Date.now()) { // Ist nicht abgelaufen
                         activeInvitesCount++;
                    }
                }
            });

            const userEmbed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle(`🔗 Invite-Statistiken für ${targetUser.tag}`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: 'Gesamteinladungen', value: `${totalUses}`, inline: true },
                    { name: 'Aktive Invites', value: `${activeInvitesCount}`, inline: true }
                )
                .setTimestamp();
            
            if (userInvites.length > 0) {
                const inviteCodesList = userInvites.map(inv => `\`${inv.code}\` (${inv.uses} Nutzungen)`).join(', ');
                userEmbed.addFields(
                    { name: 'Deine Invites', value: inviteCodesList.length > 1024 ? inviteCodesList.substring(0, 1020) + '...' : inviteCodesList, inline: false }
                );
            } else {
                 userEmbed.addFields(
                    { name: 'Deine Invites', value: 'Keine aktiven Invites gefunden.', inline: false }
                );
            }


            await interaction.reply({ embeds: [userEmbed], ephemeral: false });
        }
        /* Optional: Leaderboard Logic
        else if (subcommand === 'leaderboard') {
            if (!isEnabled) {
                return interaction.reply({ content: '❌ Der Invite Tracker ist auf diesem Server nicht aktiviert.', ephemeral: true });
            }

            if (!inviteData[guildId] || Object.keys(inviteData[guildId]).length === 0) {
                return interaction.reply({ content: '❌ Es sind noch keine Invite-Daten vorhanden, um ein Leaderboard zu erstellen.', ephemeral: true });
            }

            const inviterStats = {}; // { inviterId: totalUses }

            for (const inviteCode in inviteData[guildId]) {
                const invite = inviteData[guildId][inviteCode];
                if (invite.inviterId) {
                    if (!inviterStats[invite.inviterId]) {
                        inviterStats[invite.inviterId] = 0;
                    }
                    inviterStats[invite.inviterId] += invite.uses;
                }
            }

            const sortedInviters = Object.entries(inviterStats).sort(([, a], [, b]) => b - a);

            const leaderboardEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('🏆 Top Einlader')
                .setDescription('Die Top-Benutzer mit den meisten Einladungen auf diesem Server:')
                .setTimestamp();

            let rank = 1;
            for (const [inviterId, uses] of sortedInviters.slice(0, 10)) { // Top 10
                const user = await interaction.client.users.fetch(inviterId).catch(() => null);
                if (user) {
                    leaderboardEmbed.addFields({
                        name: `${rank}. ${user.tag}`,
                        value: `Einladungen: **${uses}**`,
                        inline: false
                    });
                    rank++;
                }
            }

            if (leaderboardEmbed.data.fields && leaderboardEmbed.data.fields.length === 0) {
                 leaderboardEmbed.setDescription('Noch keine Invite-Statistiken verfügbar.');
            }

            await interaction.reply({ embeds: [leaderboardEmbed], ephemeral: false });
        }
        */
    },
};