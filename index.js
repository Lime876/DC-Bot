// index.js
require('dotenv').config(); // Dies lädt die Variablen aus deiner .env-Datei in process.env

const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, Partials, PermissionsBitField, Events } = require('discord.js'); // Events importiert
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const logger = require('./utils/logger'); // Logger importiert

logger.debug(`[DEBUG] index.js wird ausgeführt (PID: ${process.pid})`);

// DEKLARIERE DIE TOKEN-VARIABLE HIER, BEVOR SIE VERWENDET WIRD
// Stelle sicher, dass der Name der Umgebungsvariablen (DISCORD_BOT_TOKEN)
// mit dem in deiner .env-Datei ÜBEREINSTIMMT.
const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID; // CLIENT_ID wird für das Deployment benötigt
// Optional: Guild ID für Test-Server. Wenn gesetzt, werden Commands nur auf diesem Server deployed.
// Wenn nicht gesetzt, werden Commands global deployed (kann bis zu 1 Stunde dauern).
const guildId = process.env.DISCORD_GUILD_ID; 

// Überprüfe, ob der Token und die Client ID geladen wurden, BEVOR du versuchst, dich anzumelden
if (!token) {
    logger.error('FEHLER: DISCORD_BOT_TOKEN ist in der .env-Datei nicht gefunden. Der Bot kann sich nicht anmelden.');
    process.exit(1); // Beendet den Prozess, wenn der Token fehlt
}
if (!clientId) {
    logger.error('FEHLER: DISCORD_CLIENT_ID ist in der .env-Datei nicht gefunden. Commands können nicht deployed werden.');
    process.exit(1); // Beendet den Prozess, wenn die Client ID fehlt
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates, // Für JTC
        GatewayIntentBits.GuildInvites, // Für Invite Tracker
        GatewayIntentBits.GuildMessageReactions, // Für Polls/Voting
        GatewayIntentBits.DirectMessages, // Für DMs, falls du sie loggen willst
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.GuildMember,
        Partials.User,
    ],
});

global.client = client;
// NEU: Initialisiere global.invites als eine Collection, um Einladungen pro Gilde zu speichern
global.invites = new Collection(); 

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');

// Funktion zum Leeren des Modul-Caches
function clearModuleCache() {
    logger.debug('[DEBUG] Leere Node.js Modul-Cache...');
    for (const id in require.cache) {
        // Ignoriere node_modules, um nicht unnötig viel zu leeren
        if (!id.includes('node_modules')) {
            delete require.cache[id];
        }
    }
}

// Rekursives Laden von Commands aus Unterordnern
function readCommands(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            readCommands(fullPath); // Wenn es ein Ordner ist, rekursiv durchsuchen
        } else if (file.isFile() && file.name.endsWith('.js')) {
            try {
                // Cache für die spezifische Datei löschen, bevor sie geladen wird
                delete require.cache[require.resolve(fullPath)];
                const command = require(fullPath);
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                } else {
                    logger.warn(`[WARNING] Der Befehl unter ${fullPath} hat fehlende "data" oder "execute" Eigenschaften.`);
                }
            } catch (error) {
                logger.error(`[ERROR] Fehler beim Laden des Befehls ${fullPath}:`, error);
            }
        }
    }
}

// Cache leeren, bevor Commands und Events geladen werden
clearModuleCache();
readCommands(commandsPath); // Starte das Lesen der Commands


// HIER MÜSSEN DIE EVENTS NACH DER CLIENT-INITIALISIERUNG REGISTRIERT WERDEN
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js') && file !== 'clientReady.js'); // NEU: clientReady.js ignorieren

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    try {
        // Cache für die spezifische Event-Datei löschen, bevor sie geladen wird
        delete require.cache[require.resolve(filePath)];
        logger.debug(`[DEBUG] Lade Event-Datei: ${filePath}`);
        const event = require(filePath);
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
    } catch (error) {
        logger.error(`[ERROR] Fehler beim Laden des Events ${filePath}:`, error);
    }
}

// REST-Client für API-Anfragen
const rest = new REST({ version: '10' }).setToken(token);

// Funktion zum Deployment der Slash-Befehle
async function deployCommands() {
    const commands = client.commands.map(command => command.data.toJSON());

    try {
        logger.info(`Starte Aktualisierung von ${commands.length} Anwendungsbefehlen.`);

        let data;
        if (guildId) {
            // Spezifisch für eine Gilde deployen (schneller für Tests)
            logger.info(`Deploying commands to Guild ID: ${guildId}`);
            data = await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: commands },
            );
        } else {
            // Global deployen (dauert bis zu 1 Stunde, aber für alle Gilden verfügbar)
            logger.info('Deploying commands globally...');
            data = await rest.put(
                Routes.applicationCommands(clientId),
                { body: commands },
            );
        }

        logger.info(`Erfolgreich ${data.length} Anwendungsbefehle geladen.`);
    } catch (error) {
        logger.error(`[ERROR] Fehler beim Deployment der Commands:`, error);
    }
}


// NEU: Konsolidiertes Ready-Event
client.once('ready', async () => {
    // Diese Variable ist am Client-Objekt persistent und wird nicht durch Modul-Caching beeinflusst.
    if (client.readyLogicExecuted) {
        logger.warn(`⚠️ Das Ready-Event wurde erneut ausgelöst, aber die Hauptlogik wurde bereits ausgeführt. (PID: ${process.pid})`);
        return; // Beende die Ausführung, um doppelte Initialisierung zu verhindern
    }

    client.readyLogicExecuted = true; // Markiere am Client-Objekt, dass die Logik jetzt ausgeführt wird

    logger.info(`✅ Eingeloggt als ${client.user.tag} (PID: ${process.pid}) - Erste Ausführung der Ready-Logik`);
    logger.debug(`[DEBUG] Client Ready Status: WebSocket Status = ${client.ws.status}, Ready Timestamp = ${client.readyTimestamp}`);
    
    logger.debug(`Geladene Commands: ${client.commands.map(cmd => cmd.data.name).join(', ')}`);

    // Deployment nur wenn explizit gewünscht
    if (process.env.DEPLOY_COMMANDS_ON_START === 'true') { // Prüfe auf String 'true'
        logger.info('[Startup] DEPLOY_COMMANDS_ON_START ist aktiviert. Deploye Slash-Commands...');
        await deployCommands();
    } else {
        logger.info('[Startup] DEPLOY_COMMANDS_ON_START ist deaktiviert. Überspringe Deployment.');
    }

    // NEU: Caching aller Einladungen für alle Gilden beim Bot-Start
    logger.info('[Startup] Caching aller Gilden-Einladungen...');
    for (const guild of client.guilds.cache.values()) {
        try {
            const invites = await guild.invites.fetch();
            global.invites.set(guild.id, new Collection(invites.map(invite => [invite.code, invite])));
            logger.debug(`[Startup] Caching für Gilde "${guild.name}" (${guild.id}) abgeschlossen. ${invites.size} Einladungen gefunden.`);
        } catch (error) {
            logger.warn(`[Startup] Konnte Einladungen für Gilde "${guild.name}" (${guild.id}) nicht cachen. Fehlende Berechtigungen? Fehler: ${error.message}`);
        }
    }
    logger.info('[Startup] Initiales Caching der Einladungen abgeschlossen.');


    // Debug-Bereich für Guild-Permissions
    if (guildId) {
        try {
            const guild = client.guilds.cache.get(guildId);
            if (guild) {
                const botMember = await guild.members.fetch(client.user.id);
                const botPermissions = botMember.permissions;

                logger.debug(`[DEBUG] Bot-Berechtigungen in Gilde '${guild.name}' (${guild.id}):`);
                logger.debug(`   Hat 'ModerateMembers': ${botPermissions.has(PermissionsBitField.Flags.ModerateMembers)}`);
                logger.debug(`   Hat 'ManageMessages': ${botPermissions.has(PermissionsBitField.Flags.ManageMessages)}`);
                logger.debug(`   Hat 'Administrator': ${botPermissions.has(PermissionsBitField.Flags.Administrator)}`);
            } else {
                logger.warn(`[DEBUG] Gilde mit ID ${guildId} nicht im Cache gefunden.`);
            }
        } catch (error) {
            logger.error(`[DEBUG] Fehler beim Abrufen der Bot-Berechtigungen:`, error);
        }
    }

    // Voting & Embed-Cleanup
    const votingCommand = client.commands.get('voting');
    if (votingCommand?.restoreActiveVotes) {
        await votingCommand.restoreActiveVotes(client);
    }

    const embedCommand = client.commands.get('embeds');
    if (embedCommand?.cleanupExpiredSessions) {
        logger.info('[App] Führe einmalige Bereinigung abgelaufener Embed-Sitzungen aus...');
        await embedCommand.cleanupExpiredSessions(client);
    }
});


// Allgemeine Fehlerbehandlung für den Prozess
process.on('unhandledRejection', (reason, promise) => {
    logger.error('❌ Unerwarteter Promise-Fehler:', reason, promise);
});

process.on('uncaughtException', (err, origin) => {
    logger.error('❌ Unerwarteter Client-Fehler:', err, origin);
    // Beenden Sie den Prozess, um sicherzustellen, dass keine beschädigten Zustände bestehen bleiben.
    // In Produktionsumgebungen sollten Sie hier einen Prozessmanager (PM2, systemd) verwenden,
    // um den Bot automatisch neu zu starten.
    // process.exit(1); 
});

// Graceful Shutdown bei SIGTERM (vom Watcher gesendet)
process.on('SIGTERM', async () => {
    logger.info('🛑 SIGTERM empfangen. Schließe Discord-Client...');
    if (client && client.isReady()) {
        await client.destroy(); // Meldet den Client von Discord ab
        logger.info('✅ Discord-Client erfolgreich abgemeldet.');
    } else {
        logger.info('⚠️ Discord-Client war nicht bereit oder nicht vorhanden. Beende direkt.');
    }
    process.exit(0); // Beendet den Prozess
});

// Log vor dem Login-Versuch
logger.debug('[DEBUG] Versuche Client-Login...');
// Login des Bots
client.login(token)
    .then(() => logger.debug('[DEBUG] client.login() Promise erfolgreich aufgelöst.'))
    .catch(error => {
        logger.error(`[ERROR] Fehler beim Anmelden des Bots:`, error);
        process.exit(1); // Beendet den Prozess, wenn die Anmeldung fehlschlägt
    });
