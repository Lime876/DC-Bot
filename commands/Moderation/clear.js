const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getLogChannelId } = require('../../utils/config.js'); // Pfad angepasst

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Löscht mehrere Nachrichten im aktuellen Kanal')
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('Anzahl der zu löschenden Nachrichten (max. 1000)')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  category: 'Moderation', // <-- NEU: Füge diese Zeile hinzu

  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');

    if (amount < 1 || amount > 1000) {
      return interaction.reply({
        content: '⚠️ Bitte gib eine Zahl zwischen 1 und 100 an.',
        ephemeral: true,
      });
    }

    try {
      await interaction.deferReply({ ephemeral: true });
      const deleted = await interaction.channel.bulkDelete(amount, true);

      if (deleted.size === 0) {
        await interaction.editReply({
          content: 'Es konnten keine Nachrichten gelöscht werden. Sind die Nachrichten älter als 14 Tage?',
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setAuthor({
          name: interaction.user.tag,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setDescription(`🧹 ${deleted.size} Nachrichten gelöscht`)
        .addFields(
          { name: 'Kanal:', value: `<#${interaction.channel.id}>`, inline: true },
          { name: 'Anzahl:', value: String(deleted.size), inline: true },
        )
        .setTimestamp();

      const logChannelId = getLogChannelId(interaction.guild.id);
      if (logChannelId) {
        const logChannel = interaction.guild.channels.cache.get(logChannelId);
        if (logChannel) {
          await logChannel.send({ embeds: [embed] });
        }
      }
      await interaction.editReply({
        content: `🧹 ${deleted.size} Nachrichten gelöscht.`,
        ephemeral: true,
      });

    } catch (error) {
      console.error('Fehler beim Löschen von Nachrichten:', error);
      await interaction.editReply({
        content: `❌ Fehler beim Löschen von Nachrichten: ${error.message}`,
        ephemeral: true,
      });
    }
  },
};
