module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // Button-Interaktionen verarbeiten
    if (interaction.isButton()) {
      try {
        // Rolle 1 Button
        if (interaction.customId === 'button_role1') {
          const roleId = 'ROLE_ID_1'; // Ersetze mit echter ID
          if (interaction.member.roles.cache.has(roleId)) {
            await interaction.member.roles.remove(roleId);
            await interaction.reply({ content: 'Rolle 1 wurde entfernt!', ephemeral: true });
          } else {
            await interaction.member.roles.add(roleId);
            await interaction.reply({ content: 'Rolle 1 wurde hinzugefügt!', ephemeral: true });
          }
        }

        // Rolle 2 Button
        else if (interaction.customId === 'button_role2') {
          const roleId = 'ROLE_ID_2'; // Ersetze mit echter ID
          if (interaction.member.roles.cache.has(roleId)) {
            await interaction.member.roles.remove(roleId);
            await interaction.reply({ content: 'Rolle 2 wurde entfernt!', ephemeral: true });
          } else {
            await interaction.member.roles.add(roleId);
            await interaction.reply({ content: 'Rolle 2 wurde hinzugefügt!', ephemeral: true });
          }
        }

        // Dynamisch generierte Buttons (aus reactionSetup)
        else if (interaction.customId.startsWith('reaction_')) {
          const roleId = interaction.customId.split('_')[1];
          if (!roleId.match(/^\d+$/)) {
            return await interaction.reply({ content: 'Ungültige Rollen-ID!', ephemeral: true });
          }

          const role = interaction.guild.roles.cache.get(roleId);
          if (!role) return await interaction.reply({ content: 'Rolle existiert nicht mehr.', ephemeral: true });

          if (interaction.member.roles.cache.has(role.id)) {
            await interaction.member.roles.remove(role);
            await interaction.reply({ content: `Rolle **${role.name}** entfernt.`, ephemeral: true });
          } else {
            await interaction.member.roles.add(role);
            await interaction.reply({ content: `Rolle **${role.name}** hinzugefügt.`, ephemeral: true });
          }
        }

      } catch (error) {
        console.error('Fehler bei Button-Interaktion:', error);
        if (!interaction.replied) {
          await interaction.reply({ content: 'Ein Fehler ist aufgetreten!', ephemeral: true });
        }
      }
    }

    // Slash Commands verarbeiten
    else if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`Fehler beim Ausführen von /${interaction.commandName}:`, error);
        await interaction.reply({ content: 'Beim Ausführen ist ein Fehler aufgetreten!', ephemeral: true });
      }
    }
  },
};