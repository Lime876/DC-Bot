// index.js – ESM-Version
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    Client,
    Collection,
    GatewayIntentBits,
    Partials,
    Events,
} from 'discord.js';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import logger from './utils/logger.js';
import { getAllSocialStats } from './commands/services/social/index.js';
import { loadTranslations, loadGuildLanguages } from './utils/languageUtils.js';

// __dirname & __filename in ESM bereitstellen
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

logger.debug(`[DEBUG] index.js gestartet (PID: ${process.pid})`);

// ENV-Check
['DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID'].forEach((key) => {
    if (!process.env[key]) {
        logger.error(`FEHLER: ${key} fehlt in der .env-Datei.`);
        process.exit(1);
    }
});

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.GuildMember,
        Partials.User,
    ],
});

// Exportiere die Client-Instanz, damit andere Module darauf zugreifen können
export { client };

client.commands = new Collection();
client.cooldowns = new Collection();
client.activeEmbedSessions = new Collection(); // Initialisiere hier die Sammlung

global.invites = new Collection();

// Commands rekursiv laden (mit dynamic import)
import { pathToFileURL } from 'node:url';

async function readCommands(dir) {
    if (!fs.existsSync(dir)) {
        logger.warn(`[Commands] Ordner fehlt, überspringe: ${dir}`);
        return;
    }

    for (const file of fs.readdirSync(dir, {
        withFileTypes: true
    })) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            await readCommands(fullPath);
        } else if (file.isFile() && file.name.endsWith('.js')) {
            if (file.name === 'index.js') {
                logger.debug(`[Commands] Überspringe Hilfsdatei: ${fullPath}`);
                continue;
            }

            try {
                const command = (await import(pathToFileURL(fullPath))).default || (await import(pathToFileURL(fullPath)));
                if (command?.data && command?.execute && command.data.description && typeof command.data.description === 'string') {
                    client.commands.set(command.data.name, command);
                    logger.debug(`[Commands] Command geladen: ${command.data.name}`);
                } else {
                    logger.warn(`[WARNING] Ungültiges Command (kein data/execute oder fehlende Beschreibung): ${fullPath}`);
                }
            } catch (err) {
                logger.error(`[ERROR] Fehler beim Laden: ${fullPath}`, err);
            }
        }
    }
}

// Events laden
async function loadEvents() {
    const eventsDir = path.join(__dirname, 'events');
    if (fs.existsSync(eventsDir)) {
        for (const file of fs.readdirSync(eventsDir).filter((f) => f.endsWith('.js'))) {
            try {
                const event = (await import(pathToFileURL(path.join(eventsDir, file)))).default;
                if (event?.name && typeof event.execute === 'function') {
                    if (event.once) {
                        client.once(event.name, (...args) => event.execute(...args, client));
                    } else {
                        client.on(event.name, (...args) => event.execute(...args, client));
                    }
                    logger.debug(`[Events] Event geladen: ${event.name}`);
                } else {
                    logger.warn(`[Events] Ungültiges Event-Modul: ${file}`);
                }
            } catch (err) {
                logger.error(`[ERROR] Event-Load: ${file}`, err);
            }
        }
    } else {
        logger.warn(`[Events] Ordner fehlt, überspringe: ${eventsDir}`);
    }
}

// Commands deployen
const rest = new REST({
    version: '10'
}).setToken(token);

async function deployCommands() {
    const commandsToDeploy = [];
    for (const cmd of client.commands.values()) {
        try {
            commandsToDeploy.push(cmd.data.toJSON());
        } catch (error) {
            logger.error(`[Deploy] Fehler beim Serialisieren von Befehl '${cmd.data.name}':`, error);
        }
    }

    try {
        if (!commandsToDeploy.length) {
            logger.warn('[Deploy] Keine Commands gefunden — überspringe Deploy.');
            return;
        }

        if (guildId) {
            await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
                body: commandsToDeploy
            });
            logger.info(`[Deploy] Commands an Guild ${guildId} gesendet.`);
        } else {
            await rest.put(Routes.applicationCommands(clientId), {
                body: commandsToDeploy
            });
            logger.info('[Deploy] Commands global gesendet.');
        }
    } catch (error) {
        logger.error('[Deploy] Fehler:', error);
    }
}

// Ready
client.once(Events.ClientReady, async (c) => {
    if (client.readyLogicExecuted) return;
    client.readyLogicExecuted = true;

    logger.info(`✅ Eingeloggt als ${c.user.tag}`);

    if (process.env.DEPLOY_COMMANDS_ON_START === 'true') {
        await deployCommands();
    }

    for (const guild of client.guilds.cache.values()) {
        try {
            const invs = await guild.invites.fetch();
            global.invites.set(guild.id, invs);
        } catch (e) {
            logger.warn(`[Startup] Einladungen für ${guild.name} nicht cachen: ${e.message}`);
        }
    }
    // Lade die Embed-Sessions hier und übergebe die client-Instanz
    const embedsCommand = client.commands.get('embeds');
    if (embedsCommand && embedsCommand.loadActiveEmbedSessions) {
        await embedsCommand.loadActiveEmbedSessions(client);
    }
});

// Social Command inline registrieren
client.commands.set('social', {
    data: {
        name: 'social',
        description: 'Zeigt kombinierte Social-Media-Stats',
        toJSON() {
            return this;
        }
    },
    async execute(interaction) {
        await interaction.deferReply();
        const twitter = interaction.options?.getString?.('twitter');
        const youtube = interaction.options?.getString?.('youtube');
        const twitch = interaction.options?.getString?.('twitch');

        const results = await getAllSocialStats({
            twitter,
            youtubeChannelId: youtube,
            twitch
        });

        const lines = results.map(r => {
            if (r.error) return `• ${r.platform}: ⚠️ ${r.error}`;
            if (r.platform === 'Twitter') return `• Twitter (@${r.username}): ${r.followers} Follower`;
            if (r.platform === 'YouTube') return `• YouTube (${r.channelTitle}): ${r.subscribers} Abos`;
            if (r.platform === 'Twitch') return `• Twitch (${r.displayName}): ${r.live ? 'LIVE' : 'offline'}`;
            return '• Unbekannte Plattform';
        });

        await interaction.editReply({
            content: lines.join('\n')
        });
    }
});

// Fehler-Handling & Cleanup
process.on('unhandledRejection', (reason) => {
    logger.error('❌ Promise-Fehler:', reason?.stack || reason);
});
process.on('uncaughtException', (err) => {
    logger.error('❌ Exception:', err?.stack || err);
});

async function main() {
    await loadTranslations();
    await loadGuildLanguages();
    await readCommands(path.join(__dirname, 'commands'));
    await loadEvents(); // Rufe die neue Funktion auf, um Events zu laden
    client.login(token);
}

main();
