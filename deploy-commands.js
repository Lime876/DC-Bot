// deploy-commands.js (ESM-Version)

import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';

const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;
const token = process.env.DISCORD_BOT_TOKEN;

if (!clientId || !token) {
    console.error('FEHLER: DISCORD_CLIENT_ID oder DISCORD_BOT_TOKEN fehlt in der .env-Datei.');
    process.exit(1);
}

const commands = [];
const commandsPath = path.join(path.resolve(), 'commands');

async function loadCommands(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            await loadCommands(fullPath);
        } else if (file.isFile() && file.name.endsWith('.js')) {
            try {
                const command = await import(fullPath);
                if (command.default?.data && command.default?.execute) {
                    commands.push(command.default.data.toJSON());
                } else {
                    console.warn(`[WARN] Ungültiger Command in ${fullPath}`);
                }
            } catch (err) {
                console.error(`[ERROR] Fehler beim Laden von ${fullPath}:`, err);
            }
        }
    }
}

await loadCommands(commandsPath);

const rest = new REST({ version: '10' }).setToken(token);

try {
    if (guildId) {
        console.log(`[DEPLOY] Registriere ${commands.length} Guild-Commands für Guild ${guildId}...`);
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
        console.log(`[DEPLOY] Erfolgreich alle Guild-Commands neu geladen.`);
    } else {
        console.log(`[DEPLOY] Registriere ${commands.length} globale Commands...`);
        await rest.put(Routes.applicationCommands(clientId), { body: commands });
        console.log(`[DEPLOY] Erfolgreich alle globalen Commands neu geladen.`);
    }
} catch (error) {
    console.error('[DEPLOY] Fehler beim Registrieren:', error);
}
