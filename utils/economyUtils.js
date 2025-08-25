import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ECONOMY_FILE = path.join(__dirname, '../data/economy.json');

let economyDataCache = null;

export async function loadEconomy() {
    if (economyDataCache) return economyDataCache;
    try {
        const data = await fs.readFile(ECONOMY_FILE, 'utf8');
        economyDataCache = JSON.parse(data);
        return economyDataCache;
    } catch (error) {
        if (error.code === 'ENOENT') {
            economyDataCache = {};
            return economyDataCache;
        }
        console.error('[EconomySystem] Fehler beim Laden der Wirtschaftsdaten:', error);
        economyDataCache = {};
        return economyDataCache;
    }
}

export async function saveEconomy(economyData) {
    try {
        await fs.writeFile(ECONOMY_FILE, JSON.stringify(economyData, null, 2), 'utf8');
        economyDataCache = economyData;
    } catch (error) {
        console.error('[EconomySystem] Fehler beim Speichern der Wirtschaftsdaten:', error);
    }
}

export function getUserData(userId, economyData) {
    if (!economyData[userId]) {
        economyData[userId] = { balance: 0, inventory: {}, lastWork: 0 };
    } else {
        if (typeof economyData[userId].inventory !== 'object' || economyData[userId].inventory === null) {
            economyData[userId].inventory = {};
        }
        if (typeof economyData[userId].balance !== 'number' || isNaN(economyData[userId].balance)) {
            economyData[userId].balance = 0;
        }
        if (typeof economyData[userId].lastWork !== 'number' || isNaN(economyData[userId].lastWork)) {
            economyData[userId].lastWork = 0;
        }
    }
    return economyData[userId];
}

export async function addItemToInventory(userId, itemId, quantity = 1) {
    if (!itemId || typeof itemId !== 'string') return false;
    if (!Number.isInteger(quantity) || quantity <= 0) return false;

    const economyData = await loadEconomy();
    const userData = getUserData(userId, economyData);

    userData.inventory[itemId] = (userData.inventory[itemId] || 0) + quantity;

    await saveEconomy(economyData);
    return true;
}

export async function removeItemFromInventory(userId, itemId, quantity = 1) {
    if (!itemId || typeof itemId !== 'string') return false;
    if (!Number.isInteger(quantity) || quantity <= 0) return false;

    const economyData = await loadEconomy();
    const userData = getUserData(userId, economyData);

    if (!userData.inventory[itemId] || userData.inventory[itemId] < quantity) return false;

    userData.inventory[itemId] -= quantity;

    if (userData.inventory[itemId] <= 0) {
        delete userData.inventory[itemId];
    }

    await saveEconomy(economyData);
    return true;
}