import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { loadEconomy, saveEconomy, getUserData } from '../../utils/economyUtils.js';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

const shopPath = path.join(path.dirname(new URL(import.meta.url).pathname), '../data/shop.json');

const loadShop = () => {
    if (fs.existsSync(shopPath)) {
        try {
            return JSON.parse(fs.readFileSync(shopPath, 'utf8'));
        } catch (e) {
            logger.error(`[Shop] Fehler beim Parsen von ${shopPath}:`, e);
            return [];
        }
    }
    return [];
};

const saveShop = (shopData) => {
    try {
        const dir = path.dirname(shopPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(shopPath, JSON.stringify(shopData, null, 2));
    } catch (e) {
        logger.error(`[Shop] Fehler beim Schreiben in ${shopPath}:`, e);
    }
};

export default {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Verwaltet den Shop und ermöglicht das Kaufen von Gegenständen.')
        .setDescriptionLocalizations({
            de: getTranslatedText('de', 'shop_command.DESCRIPTION'),
            'en-US': getTranslatedText('en', 'shop_command.DESCRIPTION'),
        })
        .addSubcommand(subcommand =>
            subcommand.setName('list').setDescription('Zeigt alle Gegenstände im Shop an.').setDescriptionLocalizations({
                de: getTranslatedText('de', 'shop_command.LIST_SUBCOMMAND_DESCRIPTION'),
                'en-US': getTranslatedText('en', 'shop_command.LIST_SUBCOMMAND_DESCRIPTION'),
            })
        )
        .addSubcommand(subcommand =>
            subcommand.setName('buy').setDescription('Kaufe einen Gegenstand aus dem Shop.').setDescriptionLocalizations({
                de: getTranslatedText('de', 'shop_command.BUY_SUBCOMMAND_DESCRIPTION'),
                'en-US': getTranslatedText('en', 'shop_command.BUY_SUBCOMMAND_DESCRIPTION'),
            }).addStringOption(option =>
                option.setName('item_id').setDescription('Die ID des Gegenstands, den du kaufen möchtest (z.B. "supporter_role").').setDescriptionLocalizations({
                    de: getTranslatedText('de', 'shop_command.ITEM_ID_OPTION_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'shop_command.ITEM_ID_OPTION_DESCRIPTION'),
                }).setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('add_role_item').setDescription('Fügt eine Rolle zum Shop hinzu, die gekauft werden kann.').setDescriptionLocalizations({
                de: getTranslatedText('de', 'shop_command.ADD_ROLE_ITEM_SUBCOMMAND_DESCRIPTION'),
                'en-US': getTranslatedText('en', 'shop_command.ADD_ROLE_ITEM_SUBCOMMAND_DESCRIPTION'),
            }).addRoleOption(option =>
                option.setName('rolle').setDescription('Die Rolle, die zum Verkauf angeboten werden soll.').setDescriptionLocalizations({
                    de: getTranslatedText('de', 'shop_command.ROLE_OPTION_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'shop_command.ROLE_OPTION_DESCRIPTION'),
                }).setRequired(true)
            ).addIntegerOption(option =>
                option.setName('preis').setDescription('Der Preis der Rolle in Münzen.').setDescriptionLocalizations({
                    de: getTranslatedText('de', 'shop_command.PRICE_OPTION_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'shop_command.PRICE_OPTION_DESCRIPTION'),
                }).setRequired(true).setMinValue(1)
            ).addStringOption(option =>
                option.setName('item_id').setDescription('Eine eindeutige ID für dieses Shop-Item (z.B. "vip_role").').setDescriptionLocalizations({
                    de: getTranslatedText('de', 'shop_command.ITEM_ID_ADD_OPTION_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'shop_command.ITEM_ID_ADD_OPTION_DESCRIPTION'),
                }).setRequired(true)
            ).addStringOption(option =>
                option.setName('beschreibung').setDescription('Eine kurze Beschreibung für die Rolle im Shop.').setDescriptionLocalizations({
                    de: getTranslatedText('de', 'shop_command.DESCRIPTION_ADD_OPTION_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'shop_command.DESCRIPTION_ADD_OPTION_DESCRIPTION'),
                }).setRequired(false)
            ).addStringOption(option =>
                option.setName('emoji').setDescription('Ein Emoji, das im Shop neben dem Item angezeigt wird (z.B. 🌟).').setDescriptionLocalizations({
                    de: getTranslatedText('de', 'shop_command.EMOJI_OPTION_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'shop_command.EMOJI_OPTION_DESCRIPTION'),
                }).setRequired(false)
            )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('remove_item').setDescription('Entfernt ein Item aus dem Shop.').setDescriptionLocalizations({
                de: getTranslatedText('de', 'shop_command.REMOVE_ITEM_SUBCOMMAND_DESCRIPTION'),
                'en-US': getTranslatedText('en', 'shop_command.REMOVE_ITEM_SUBCOMMAND_DESCRIPTION'),
            }).addStringOption(option =>
                option.setName('item_id').setDescription('Die ID des Items, das entfernt werden soll.').setDescriptionLocalizations({
                    de: getTranslatedText('de', 'shop_command.ITEM_ID_REMOVE_OPTION_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'shop_command.ITEM_ID_REMOVE_OPTION_DESCRIPTION'),
                }).setRequired(true)
            )
        ),
    category: 'Economy',

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        let shopItems = loadShop();
        const economyData = loadEconomy();
        const userData = getUserData(interaction.user.id, economyData);
        const member = interaction.member;
        const lang = await getGuildLanguage(interaction.guildId);

        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        if (subcommand === 'add_role_item' || subcommand === 'remove_item') {
            if (!member.permissions.has(PermissionFlagsBits.ManageRoles)) {
                return interaction.editReply({ content: getTranslatedText(lang, 'shop_command.NO_PERMISSION_MANAGE_SHOP') });
            }
        }

        // Hier würde die restliche Subcommand-Logik analog zu deinem bestehenden Code weitergeführt werden...
    }
};
