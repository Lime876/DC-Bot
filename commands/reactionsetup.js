const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reaktionsetup')
    .setDescription('Erstelle eine Reaktionsrolle')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    await interaction.reply({ content: 'Lass uns dein Reaktionsrollen-Setup starten. Ich stelle dir ein paar Fragen...', ephemeral: true });

    const ask = async (question) => {
      await interaction.followUp({ content: question, ephemeral: true });
      const collected = await interaction.channel.awaitMessages({
        filter: (m) => m.author.id === interaction.user.id,
        max: 1,
        time: 60000,
        errors: ['time']
      }).catch(() => null);

      return collected?.first()?.content;
    };

    const title = await ask('Was soll der **Titel** der Nachricht sein?');
    if (!title) return interaction.followUp({ content: 'Zeit abgelaufen.', ephemeral: true });

    const description = await ask('Was soll der **Text** sein?');
    if (!description) return interaction.followUp({ content: 'Zeit abgelaufen.', ephemeral: true });

    const emoji = await ask('Welches **Emoji** soll verwendet werden? (z. B. 🚀)');
    if (!emoji) return interaction.followUp({ content: 'Zeit abgelaufen.', ephemeral: true });

    const roleMention = await ask('Welche **Rolle** soll gegeben werden? (pinge sie mit @rolle)');
    const roleIdMatch = roleMention?.match(/<@&([0-9]+)>/);
    const role = roleIdMatch ? interaction.guild.roles.cache.get(roleIdMatch[1]) : null;

    if (!role) return interaction.followUp({ content: 'Keine gültige Rolle erkannt.', ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor('Blurple');

    const button = new ButtonBuilder()
      .setCustomId(`reaction_${role.id}`)
      .setLabel('Rolle erhalten')
      .setEmoji(emoji)
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    await interaction.channel.send({ embeds: [embed], components: [row] });

    await interaction.followUp({ content: 'Reaktionsrolle eingerichtet!', ephemeral: true });
  },
};