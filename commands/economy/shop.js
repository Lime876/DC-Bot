// commands/shop.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const shopPath = path.join(__dirname, '../data/shop.json');
const { loadEconomy, saveEconomy, getUserData } = require('../../utils/economyUtils');

// Shop-Daten laden
const loadShop = () => {
    if (fs.existsSync(shopPath)) {
        try {
            return JSON.parse(fs.readFileSync(shopPath, 'utf8'));
        } catch (e) {
            console.error(`Fehler beim Parsen von ${shopPath}:`, e);
            return [];
        }
    }
    return [];
};

// Shop-Daten speichern
const saveShop = (shopData) => {
    try {
        fs.writeFileSync(shopPath, JSON.stringify(shopData, null, 2));
    } catch (e) {
        console.error(`Fehler beim Schreiben in ${shopPath}:`, e);
    }
};


module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Verwaltet den Shop und ermöglicht das Kaufen von Gegenständen.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Zeigt alle Gegenstände im Shop an.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('buy')
                .setDescription('Kaufe einen Gegenstand aus dem Shop.')
                .addStringOption(option =>
                    option.setName('item_id')
                        .setDescription('Die ID des Gegenstands, den du kaufen möchtest (z.B. "supporter_role").')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('add_role_item')
                .setDescription('Fügt eine Rolle zum Shop hinzu, die gekauft werden kann.')
                .addRoleOption(option =>
                    option.setName('rolle')
                        .setDescription('Die Rolle, die zum Verkauf angeboten werden soll.')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('preis')
                        .setDescription('Der Preis der Rolle in Münzen.')
                        .setRequired(true)
                        .setMinValue(1))
                .addStringOption(option =>
                    option.setName('item_id')
                        .setDescription('Eine eindeutige ID für dieses Shop-Item (z.B. "vip_role").')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('beschreibung')
                        .setDescription('Eine kurze Beschreibung für die Rolle im Shop.')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('emoji')
                        .setDescription('Ein Emoji, das im Shop neben dem Item angezeigt wird (z.B. 🌟).')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove_item')
                .setDescription('Entfernt ein Item aus dem Shop.')
                .addStringOption(option =>
                    option.setName('item_id')
                        .setDescription('Die ID des Items, das entfernt werden soll.')
                        .setRequired(true))),
                category: 'Economy', // <-- NEU: Füge diese Zeile hinzu


    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        let shopItems = loadShop(); // Lade Shop-Items als veränderbare Variable
        const economyData = loadEconomy();
        const userData = getUserData(interaction.user.id, economyData);
        const member = interaction.member;

        // Manuelle Berechtigungsprüfung für Admin-Commands
        if (subcommand === 'add_role_item' || subcommand === 'remove_item') {
            // Nur Benutzer mit der Berechtigung "Rollen verwalten" dürfen diese Subcommands nutzen
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
                return interaction.reply({ content: '❌ Du hast nicht die Berechtigung, Shop-Items zu verwalten. (Benötigt: `Manage Roles` oder `Rollen verwalten`)', ephemeral: true });
            }
        }


        if (subcommand === 'list') {
            if (shopItems.length === 0) {
                return interaction.reply({ content: 'Der Shop ist derzeit leer.', ephemeral: true });
            }

            const shopEmbed = new EmbedBuilder()
                .setColor(0xEE82EE)
                .setTitle('🛒 Bot-Shop')
                .setDescription('Hier sind die verfügbaren Gegenstände:')
                .setTimestamp()
                .setFooter({ text: 'Verwende /shop buy [Item-ID] um zu kaufen' });

            shopItems.forEach(item => {
                const itemTypeInfo = item.type === 'role' ? ` (Rolle: <@&${item.roleId}>)` : '';
                shopEmbed.addFields(
                    { name: `${item.emoji || ''} ${item.name} (${item.price} Münzen)${itemTypeInfo}`, value: `ID: \`${item.id}\`\n${item.description}`, inline: false }
                );
            });

            await interaction.reply({ embeds: [shopEmbed] });

        } else if (subcommand === 'buy') {
            const itemId = interaction.options.getString('item_id');
            const itemToBuy = shopItems.find(item => item.id === itemId);

            if (!itemToBuy) {
                return interaction.reply({ content: '❌ Dieser Gegenstand existiert nicht im Shop. Überprüfe die ID.', ephemeral: true });
            }

            if (userData.balance < itemToBuy.price) {
                return interaction.reply({ content: `❌ Du hast nicht genug Münzen, um "${itemToBuy.name}" zu kaufen. Du benötigst **${itemToBuy.price} Münzen**, hast aber nur **${userData.balance} Münzen**.`, ephemeral: true });
            }

            // --- KAUF-LOGIK ---
            userData.balance -= itemToBuy.price; // Geld abziehen

            let replyMessage = `✅ Du hast erfolgreich "${itemToBuy.name}" für **${itemToBuy.price} Münzen** gekauft! Dein neues Guthaben: **${userData.balance} Münzen**.`;
            let successColor = 0x00FF00; // Grün

            if (itemToBuy.type === 'role') {
                const roleId = itemToBuy.roleId;
                if (!roleId) {
                    console.error(`Shop-Item ${itemToBuy.id} ist vom Typ 'role' hat aber keine roleId.`);
                    return interaction.reply({ content: '❌ Interner Shop-Fehler: Die Rolle kann nicht zugewiesen werden. Bitte kontaktiere einen Administrator.', ephemeral: true });
                }

                const role = interaction.guild.roles.cache.get(roleId);

                if (!role) {
                    replyMessage = `❌ Die Rolle **${itemToBuy.name}** existiert auf diesem Server nicht mehr. Geld wurde zurückerstattet.`;
                    successColor = 0xFF0000;
                    userData.balance += itemToBuy.price; // Geld zurückerstatten
                } else if (interaction.guild.members.me.roles.highest.position <= role.position) {
                    replyMessage = `❌ Ich kann die Rolle **${role.name}** nicht zuweisen, da sie über meiner höchsten Rolle liegt oder gleichrangig ist. Bitte informiere einen Administrator. Geld wurde zurückerstattet.`;
                    successColor = 0xFF0000;
                    userData.balance += itemToBuy.price; // Geld zurückerstatten
                } else if (member.roles.cache.has(roleId)) {
                    replyMessage = `❌ Du besitzt die Rolle **${role.name}** bereits! Geld wurde zurückerstattet.`;
                    successColor = 0xFF0000;
                    userData.balance += itemToBuy.price; // Geld zurückerstatten
                } else {
                    try {
                        await member.roles.add(role, `Hat Rolle im Shop für ${itemToBuy.price} Münzen gekauft.`);
                        replyMessage += `\nDu hast die Rolle <@&${role.id}> erhalten.`;
                    } catch (error) {
                        console.error(`Fehler beim Zuweisen der Rolle ${role.name} an ${member.user.tag}:`, error);
                        replyMessage = `❌ Beim Zuweisen der Rolle **${role.name}** ist ein Fehler aufgetreten. Bitte kontaktiere einen Administrator. Geld wurde zurückerstattet.`;
                        successColor = 0xFF0000;
                        userData.balance += itemToBuy.price; // Geld zurückerstatten
                    }
                }
            }
            // --- ENDE KAUF-LOGIK ---

            saveEconomy(economyData); // Guthaben speichern
            
            const buyEmbed = new EmbedBuilder()
                .setColor(successColor)
                .setTitle('🛒 Kauf abgeschlossen!')
                .setDescription(replyMessage)
                .setTimestamp()
                .setFooter({ text: 'Wirtschaftssystem' });

            await interaction.reply({ embeds: [buyEmbed], ephemeral: false });

        } else if (subcommand === 'add_role_item') {
            const role = interaction.options.getRole('rolle');
            const price = interaction.options.getInteger('preis');
            const itemId = interaction.options.getString('item_id');
            const description = interaction.options.getString('beschreibung') || `Kaufe die Rolle ${role.name}.`;
            const emoji = interaction.options.getString('emoji') || '';

            // Prüfen, ob eine Rolle mit dieser ID bereits im Shop ist
            if (shopItems.some(item => item.id === itemId)) {
                return interaction.reply({ content: `❌ Ein Shop-Item mit der ID \`${itemId}\` existiert bereits. Bitte wähle eine andere ID.`, ephemeral: true });
            }
            // Prüfen, ob die Rolle selbst bereits als kaufbares Item existiert
            if (shopItems.some(item => item.type === 'role' && item.roleId === role.id)) {
                return interaction.reply({ content: `❌ Die Rolle **${role.name}** wird bereits im Shop zum Kauf angeboten.`, ephemeral: true });
            }

            // Prüfen, ob der Bot die Rolle überhaupt zuweisen könnte (Hierarchie)
            if (interaction.guild.members.me.roles.highest.position <= role.position) {
                 return interaction.reply({ content: `❌ Ich kann diese Rolle nicht zum Verkauf anbieten, da sie über meiner höchsten Rolle liegt oder gleichrangig ist. Bitte positioniere meine Rolle über dieser Rolle.`, ephemeral: true });
            }

            const newRoleItem = {
                id: itemId,
                name: role.name,
                description: description,
                price: price,
                emoji: emoji,
                type: "role",
                roleId: role.id
            };

            shopItems.push(newRoleItem);
            saveShop(shopItems); // Shop-Daten speichern

            const addEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('➕ Rolle zum Shop hinzugefügt!')
                .setDescription(`Die Rolle <@&${role.id}> wurde erfolgreich zum Shop hinzugefügt.`)
                .addFields(
                    { name: 'Item-ID', value: `\`${itemId}\``, inline: true },
                    { name: 'Preis', value: `${price} Münzen`, inline: true },
                    { name: 'Beschreibung', value: description, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'Shop-Management' });

            await interaction.reply({ embeds: [addEmbed], ephemeral: false });

        } else if (subcommand === 'remove_item') {
            const itemId = interaction.options.getString('item_id');
            const initialLength = shopItems.length;

            shopItems = shopItems.filter(item => item.id !== itemId);

            if (shopItems.length === initialLength) {
                return interaction.reply({ content: `❌ Kein Shop-Item mit der ID \`${itemId}\` gefunden.`, ephemeral: true });
            }

            saveShop(shopItems); // Shop-Daten speichern

            const removeEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('➖ Item aus Shop entfernt!')
                .setDescription(`Das Shop-Item mit der ID \`${itemId}\` wurde erfolgreich entfernt.`)
                .setTimestamp()
                .setFooter({ text: 'Shop-Management' });

            await interaction.reply({ embeds: [removeEmbed], ephemeral: false });
        }
    },
};