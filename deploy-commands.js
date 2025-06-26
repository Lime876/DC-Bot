// deploy-commands.js
require('dotenv').config(); // Lade Umgebungsvariablen aus der .env Datei

const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Hole die Werte aus den Umgebungsvariablen (deiner .env Datei)
const clientId = process.env.DISCORD_CLIENT_ID;
const token = process.env.DISCORD_BOT_TOKEN;

// Stelle sicher, dass die Variablen auch vorhanden sind
if (!clientId || !token) {
    console.error('FEHLER: DISCORD_CLIENT_ID oder DISCORD_BOT_TOKEN ist in der .env-Datei nicht definiert.');
    process.exit(1); // Beende den Prozess, wenn wichtige Variablen fehlen
}

const commands = [];
// Pfad zum 'commands' Ordner
const commandsPath = path.join(__dirname, 'commands');

// Rekursive Funktion zum Durchsuchen von Ordnern
function readCommands(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            readCommands(fullPath); // Wenn es ein Ordner ist, rekursiv durchsuchen
        } else if (file.isFile() && file.name.endsWith('.js')) {
            const command = require(fullPath);
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
            } else {
                console.log(`[WARNING] Der Befehl unter ${fullPath} hat fehlende "data" oder "execute" Eigenschaften.`);
            }
        }
    }
}

// Starte das Lesen der Commands
readCommands(commandsPath);


// Construct and deploy your commands!
const rest = new REST().setToken(token);

(async () => {
	try {
		console.log(`Starte Aktualisierung von ${commands.length} Anwendungs-(/) Befehlen global.`);

        // Globales Deployment der Commands (dauert bis zu 1 Stunde)
        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );
        console.log(`Erfolgreich ${data.length} Globale Anwendungs-(/) Befehle neu geladen.`);

	} catch (error) {
		console.error(error);
        if (error.status === 401) {
            console.error('Möglicher Fehler: Bot-Token ist ungültig oder Client ID falsch.');
        } else if (error.status === 403) {
            console.error('Möglicher Fehler: Der Bot hat nicht die Berechtigung, Slash Commands zu registrieren (z.B. fehlender "applications.commands" OAuth2 Scope).');
        } else if (error.status === 404) {
            console.error('Möglicher Fehler: Client ID ist ungültig.');
        }
	}
})();