// commands/levelroles.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const levelRolesPath = path.join(__dirname, '../data/levelRoles.json');

// Hilfsfunktionen zum Laden/Speichern der Level-Rollen-Daten
const loadLevelRoles = () => {
    if (fs.existsSync(levelRolesPath)) {
        try {
            return JSON.parse(fs.readFileSync(levelRolesPath, 'utf8'));
        } catch (e) {
            console.error(`Fehler beim Parsen von ${levelRolesPath}:`, e);
            return {};
        }
    }
    return {};
};

const saveLevelRoles = (levelRolesData) => {
    try {
        fs.writeFileSync(levelRolesPath, JSON.stringify(levelRolesData, null, 2));
    } catch (e) {
        console.error(`Fehler beim Schreiben in ${levelRolesPath}:`, e);
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('levelroles')
        .setDescription('Verwaltet Rollen, die bei einem bestimmten Level vergeben werden.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) // Nur für Benutzer, die Rollen verwalten dürfen
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Fügt eine Rolle hinzu, die ab einem bestimmten Level vergeben wird.')
                .addIntegerOption(option =>
                    option.setName('level')
                        .setDescription('Das Level, ab dem die Rolle vergeben werden soll.')
                        .setRequired(true)
                        .setMinValue(1))
                .addRoleOption(option =>
                    option.setName('rolle')
                        .setDescription('Die Rolle, die vergeben werden soll.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Entfernt eine Level-Rolle.')
                .addIntegerOption(option =>
                    option.setName('level')
                        .setDescription('Das Level, dessen Rolle entfernt werden soll.')
                        .setRequired(true)
                        .setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Zeigt alle konfigurierten Level-Rollen an.')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const levelRolesData = loadLevelRoles();

        if (!levelRolesData[guildId]) {
            levelRolesData[guildId] = [];
        }

        if (subcommand === 'add') {
            const level = interaction.options.getInteger('level');
            const role = interaction.options.getRole('rolle');

            // Prüfen, ob für dieses Level bereits eine Rolle konfiguriert ist
            const existingRoleIndex = levelRolesData[guildId].findIndex(lr => lr.level === level);

            if (existingRoleIndex !== -1) {
                // Rolle für dieses Level aktualisieren
                levelRolesData[guildId][existingRoleIndex].roleId = role.id;
                await interaction.reply({ content: `✅ Die Rolle für Level **${level}** wurde auf **${role.name}** aktualisiert.`, ephemeral: true });
            } else {
                // Neue Rolle hinzufügen
                levelRolesData[guildId].push({ level: level, roleId: role.id });
                await interaction.reply({ content: `✅ Rolle **${role.name}** wird jetzt ab Level **${level}** vergeben.`, ephemeral: true });
            }
            // Sortiere nach Level, um die Anzeige und spätere Logik zu vereinfachen
            levelRolesData[guildId].sort((a, b) => a.level - b.level);
            saveLevelRoles(levelRolesData);

        } else if (subcommand === 'remove') {
            const level = interaction.options.getInteger('level');
            const initialLength = levelRolesData[guildId].length;
            levelRolesData[guildId] = levelRolesData[guildId].filter(lr => lr.level !== level);

            if (levelRolesData[guildId].length === initialLength) {
                return interaction.reply({ content: '❌ Für dieses Level ist keine Rolle konfiguriert.', ephemeral: true });
            }

            saveLevelRoles(levelRolesData);
            await interaction.reply({ content: `✅ Die Level-Rolle für Level **${level}** wurde erfolgreich entfernt.`, ephemeral: true });

        } else if (subcommand === 'list') {
            const roles = levelRolesData[guildId];

            if (!roles || roles.length === 0) {
                return interaction.reply({ content: '📜 Es sind derzeit keine Level-Rollen konfiguriert.', ephemeral: true });
            }

            const listEmbed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('📜 Konfigurierte Level-Rollen')
                .setDescription('Hier ist eine Liste der Rollen, die bei bestimmten Leveln vergeben werden:')
                .setTimestamp();

            for (const lr of roles) {
                const role = interaction.guild.roles.cache.get(lr.roleId);
                if (role) {
                    listEmbed.addFields(
                        { name: `Level ${lr.level}`, value: `<@&${role.id}>`, inline: true }
                    );
                } else {
                    listEmbed.addFields(
                        { name: `Level ${lr.level}`, value: `Unbekannte Rolle (ID: ${lr.roleId})`, inline: true }
                    );
                }
            }

            await interaction.reply({ embeds: [listEmbed] });
        }
    },
};