const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Erstellt eine Umfrage mit Optionen.')
        .addStringOption(option =>
            option.setName('frage')
                .setDescription('Die Frage der Umfrage')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('option1')
                .setDescription('Erste Antwortoption')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option2')
                .setDescription('Zweite Antwortoption')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option3')
                .setDescription('Dritte Antwortoption')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option4')
                .setDescription('Vierte Antwortoption')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option5')
                .setDescription('Fünfte Antwortoption')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option6')
                .setDescription('Sechste Antwortoption')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option7')
                .setDescription('Siebte Antwortoption')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option8')
                .setDescription('Achte Antwortoption')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option9')
                .setDescription('Neunte Antwortoption')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option10')
                .setDescription('Zehnte Antwortoption')
                .setRequired(false)),

    async execute(interaction) {
        const question = interaction.options.getString('frage');
        const options = [];

        // Sammle alle Optionen
        for (let i = 1; i <= 10; i++) {
            const option = interaction.options.getString(`option${i}`);
            if (option) {
                options.push(option);
            }
        }

        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        const reactions = [];

        let description = `Umfrage von: ${interaction.user}\n\n`;

        if (options.length > 0) {
            // Umfrage mit spezifischen Optionen
            for (let i = 0; i < options.length; i++) {
                description += `${emojis[i]} ${options[i]}\n`;
                reactions.push(emojis[i]);
            }
        } else {
            // Ja/Nein-Umfrage, wenn keine Optionen angegeben sind
            description += '👍 Ja\n👎 Nein';
            reactions.push('👍', '👎');
        }

        const pollEmbed = new EmbedBuilder()
            .setColor(0x0099FF) // Eine schöne blaue Farbe
            .setTitle(question)
            .setDescription(description)
            .setTimestamp()
            .setFooter({ text: `Erstellt von ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

        const replyMessage = await interaction.reply({ embeds: [pollEmbed], fetchReply: true });

        // Füge Reaktionen hinzu
        for (const emoji of reactions) {
            try {
                await replyMessage.react(emoji);
            } catch (error) {
                console.error(`Fehler beim Hinzufügen der Reaktion ${emoji}:`, error);
                // Optional: Eine Fehlermeldung an den Benutzer senden, wenn eine Reaktion fehlschlägt
            }
        }
    },
};