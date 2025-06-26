// index.js
require('dotenv').config(); // Dies lädt die Variablen aus deiner .env-Datei in process.env

const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, Partials, MessageFlags } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');

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
    console.error('FEHLER: DISCORD_BOT_TOKEN ist in der .env-Datei nicht gefunden. Der Bot kann sich nicht anmelden.');
    process.exit(1); // Beendet den Prozess, wenn der Token fehlt
}
if (!clientId) {
    console.error('FEHLER: DISCORD_CLIENT_ID ist in der .env-Datei nicht gefunden. Commands können nicht deployed werden.');
    process.exit(1); // Beendet den Prozess, wenn die Client ID fehlt
}

// HIER WIRD DER CLIENT INITIALISIERT UND DEFINIERT
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // Wichtig für messageDelete event
        GatewayIntentBits.GuildMembers,   // Wichtig für Audit Log und Member Caching
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences // Oft benötigt für Audit Logs und Member Intents
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User, Partials.GuildMember] // GuildMember partial hinzugefügt
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');

// Rekursives Laden von Commands aus Unterordnern
function readCommands(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            readCommands(fullPath); // Wenn es ein Ordner ist, rekursiv durchsuchen
        } else if (file.isFile() && file.name.endsWith('.js')) {
            try {
                const command = require(fullPath);
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                } else {
                    console.log(`[WARNING] Der Befehl unter ${fullPath} hat fehlende "data" oder "execute" Eigenschaften.`);
                }
            } catch (error) {
                console.error(`[ERROR] Fehler beim Laden des Befehls ${fullPath}:`, error);
            }
        }
    }
}
readCommands(commandsPath); // Starte das Lesen der Commands


// HIER MÜSSEN DIE EVENTS NACH DER CLIENT-INITIALISIERUNG REGISTRIERT WERDEN
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    try {
        const event = require(filePath);
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
    } catch (error) {
        console.error(`[ERROR] Fehler beim Laden des Events ${filePath}:`, error);
    }
}

// REST-Client für API-Anfragen
const rest = new REST({ version: '10' }).setToken(token);

// Funktion zum Deployment der Slash-Befehle
async function deployCommands() {
    const commands = client.commands.map(command => command.data.toJSON());

    try {
        console.log(`Starte Aktualisierung von ${commands.length} Anwendungsbefehlen.`);

        let data;
        if (guildId) {
            // Spezifisch für eine Gilde deployen (schneller für Tests)
            console.log(`Deploying commands to Guild ID: ${guildId}`);
            data = await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: commands },
            );
        } else {
            // Global deployen (dauert bis zu 1 Stunde, aber für alle Gilden verfügbar)
            console.log('Deploying commands globally...');
            data = await rest.put(
                Routes.applicationCommands(clientId),
                { body: commands },
            );
        }

        console.log(`Erfolgreich ${data.length} Anwendungsbefehle geladen.`);
    } catch (error) {
        console.error(`[ERROR] Fehler beim Deployment der Commands:`, error);
    }
}


client.once('ready', async () => {
    console.log(`✅ Eingeloggt als ${client.user.tag}`);

    // Optional: Logge die geladenen Commands zur Überprüfung
    console.log(`Geladene Commands: ${client.commands.map(cmd => cmd.data.name).join(', ')}`);

    // Commands deployen
    await deployCommands();

    // Wiederherstellen aktiver Abstimmungen
    const votingCommand = client.commands.get('voting');
    if (votingCommand && votingCommand.restoreActiveVotes) {
        await votingCommand.restoreActiveVotes(client);
    }

    // Embed Builder: Bereinigung abgelaufener Sitzungen beim Start
    const embedCommand = client.commands.get('embeds'); // Stelle sicher, dass der embeds-Befehl geladen ist
    if (embedCommand && embedCommand.cleanupExpiredSessions) {
        console.log('[App] Führe einmalige Bereinigung abgelaufener Embed-Sitzungen aus...');
        await embedCommand.cleanupExpiredSessions(client);
        // Optional: Regelmäßige Bereinigung, z.B. alle 10 Minuten
        // setInterval(() => embedCommand.cleanupExpiredSessions(client), 10 * 60 * 1000);
    }
});

// Allgemeine Fehlerbehandlung für den Prozess
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unerwarteter Promise-Fehler:', reason, promise);
});

process.on('uncaughtException', (err, origin) => {
    console.error('❌ Unerwarteter Client-Fehler:', err, origin);
    // Beenden Sie den Prozess, um sicherzustellen, dass keine beschädigten Zustände bestehen bleiben.
    // In Produktionsumgebungen sollten Sie hier einen Prozessmanager (PM2, systemd) verwenden,
    // um den Bot automatisch neu zu starten.
    // process.exit(1); 
});

// Login des Bots
client.login(token)
    .catch(error => {
        console.error(`[ERROR] Fehler beim Anmelden des Bots:`, error);
        process.exit(1); // Beendet den Prozess, wenn die Anmeldung fehlschlägt
    });
