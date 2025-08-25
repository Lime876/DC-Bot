import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';

export default {
    data: new SlashCommandBuilder()
        .setName('levelroles')
        .setDescription('Manage level roles.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const filePath = path.join(process.cwd(), 'data', 'levelroles.json');

        if (!fs.existsSync(filePath)) {
            return interaction.reply({ content: '⚠️ Level roles configuration file not found.', ephemeral: true });
        }

        let levelRoles;
        try {
            const fileData = fs.readFileSync(filePath, 'utf8');
            levelRoles = JSON.parse(fileData);
        } catch (error) {
            console.error('[ERROR] Failed to read or parse levelroles.json:', error);
            return interaction.reply({ content: '❌ Failed to load level roles configuration.', ephemeral: true });
        }

        if (!Array.isArray(levelRoles) || levelRoles.length === 0) {
            return interaction.reply({ content: 'ℹ️ No level roles configured.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('📊 Level Roles')
            .setDescription('List of configured level roles:')
            .setColor('Blue');

        for (const roleData of levelRoles) {
            embed.addFields({
                name: `Level ${roleData.level}`,
                value: `<@&${roleData.roleId}>`,
                inline: true
            });
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};