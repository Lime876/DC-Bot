require('dotenv').config();

const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const clientId = process.env.DISCORD_CLIENT_ID;
const token = process.env.DISCORD_BOT_TOKEN;

if (!clientId || !token) {
    console.error('FEHLER: DISCORD_CLIENT_ID oder DISCORD_BOT_TOKEN ist in der .env-Datei nicht definiert.');
    process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

function readCommands(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            readCommands(fullPath);
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

readCommands(commandsPath);

const rest = new REST().setToken(token);

(async () => {
    try {
        console.log(`Lösche alle globalen Slash-Commands...`);
        // Alle globalen Commands löschen (leere Liste)
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: [] }
        );
        console.log(`Alle globalen Slash-Commands gelöscht.`);

        console.log(`Registriere ${commands.length} neue globale Slash-Commands...`);
        // Neue Commands registrieren
        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands }
        );
        console.log(`Erfolgreich ${data.length} globale Slash-Commands neu geladen.`);

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
