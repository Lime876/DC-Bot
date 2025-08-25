import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(process.cwd(), 'data', 'jtcConfig.json');
let jtcConfigs = {};

export async function loadJTCConfig() {
    console.log(`[JTC Config] Lade JTC Config von: ${configPath}`);
    const dir = path.dirname(configPath);
    try {
        if (!fs.existsSync(dir)) {
            await fs.promises.mkdir(dir, { recursive: true });
            console.log(`[JTC Config] Verzeichnis erstellt: ${dir}`);
        }
        if (fs.existsSync(configPath)) {
            const data = await fs.promises.readFile(configPath, 'utf8');
            jtcConfigs = JSON.parse(data);
            console.log(`[JTC Config] JTC-Konfiguration geladen.`);
        } else {
            jtcConfigs = {};
            await fs.promises.writeFile(configPath, JSON.stringify(jtcConfigs, null, 2), 'utf8');
            console.log(`[JTC Config] Leere jtcConfig.json erstellt.`);
        }
    } catch (e) {
        console.error(`[JTC Config ERROR] Fehler beim Laden/Erstellen der Config:`, e);
        if (fs.existsSync(configPath)) {
            const backupPath = `${configPath}.bak-${Date.now()}`;
            try {
                await fs.promises.rename(configPath, backupPath);
                console.log(`[JTC Config] Backup der defekten Config erstellt: ${backupPath}`);
                jtcConfigs = {};
            } catch (backupErr) {
                console.error(`[JTC Config ERROR] Backup fehlgeschlagen:`, backupErr);
            }
        } else {
            jtcConfigs = {};
        }
    }
}

async function saveJTCConfig() {
    try {
        await fs.promises.writeFile(configPath, JSON.stringify(jtcConfigs, null, 2), 'utf8');
        console.log(`[JTC Config] JTC-Konfiguration gespeichert.`);
    } catch (e) {
        console.error(`[JTC Config ERROR] Fehler beim Speichern:`, e);
    }
}

export function getJTCConfigForGuild(guildId) {
    return jtcConfigs[guildId] || null;
}

export async function setJTCConfigForGuild(guildId, channelId, categoryId) {
    jtcConfigs[guildId] = { channelId, categoryId };
    await saveJTCConfig();
    console.log(`[JTC Config] Config gesetzt für Guild ${guildId}: Channel ${channelId}, Kategorie ${categoryId}`);
}

export async function deleteJTCConfigForGuild(guildId) {
    if (jtcConfigs[guildId]) {
        delete jtcConfigs[guildId];
        await saveJTCConfig();
        console.log(`[JTC Config] Config gelöscht für Guild ${guildId}.`);
        return true;
    }
    return false;
}

// Beim Start async laden
loadJTCConfig().catch(console.error);
