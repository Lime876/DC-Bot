// utils/economyUtils.js (BEREINIGT UND KORRIGIERT)

const fs = require('fs');
const path = require('path');

const ECONOMY_FILE = path.join(__dirname, '../data/economy.json'); // Stellt sicher, dass dies der richtige Pfad ist

/**
 * Lädt die gesamte Wirtschaftsinformation aus der Datei.
 * @returns {object} Die Wirtschaftsinformationen.
 */
const loadEconomy = () => {
    if (fs.existsSync(ECONOMY_FILE)) {
        try {
            const data = fs.readFileSync(ECONOMY_FILE, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('[EconomySystem] Fehler beim Laden der Wirtschaftsdaten:', error);
            return {}; // Gib ein leeres Objekt zurück, wenn die Datei ungültig ist
        }
    }
    return {}; // Gib ein leeres Objekt zurück, wenn die Datei nicht existiert
};

/**
 * Speichert die gesamte Wirtschaftsinformation in die Datei.
 * @param {object} economyData - Die zu speichernden Wirtschaftsinformationen.
 */
const saveEconomy = (economyData) => {
    try {
        fs.writeFileSync(ECONOMY_FILE, JSON.stringify(economyData, null, 2));
    } catch (error) {
        console.error('[EconomySystem] Fehler beim Speichern der Wirtschaftsdaten:', error);
    }
};

/**
 * Holt Benutzerdaten oder erstellt sie, falls sie nicht existieren,
 * und stellt sicher, dass alle notwendigen Felder vorhanden sind.
 * @param {string} userId - Die ID des Benutzers.
 * @param {object} economyData - Die aktuellen Wirtschaftsinformationen.
 * @returns {object} Die Daten des Benutzers.
 */
const getUserData = (userId, economyData) => {
    // Wenn der Benutzer noch keine Daten hat, initialisiere ihn komplett
    if (!economyData[userId]) {
        economyData[userId] = {
            balance: 0,
            inventory: {},
            lastWork: 0,
            // Füge hier weitere Standardwerte für neue Benutzer hinzu
        };
    } else {
        // Wenn der Benutzer bereits Daten hat, stelle sicher, dass alle Felder vorhanden sind
        // Dies dient der Schema-Migration für ältere Benutzerdaten
        if (typeof economyData[userId].inventory === 'undefined' || economyData[userId].inventory === null) {
            economyData[userId].inventory = {};
        }
        if (typeof economyData[userId].balance === 'undefined' || economyData[userId].balance === null) {
            economyData[userId].balance = 0;
        }
        if (typeof economyData[userId].lastWork === 'undefined' || economyData[userId].lastWork === null) {
            economyData[userId].lastWork = 0;
        }
        // Füge hier weitere Checks für andere Felder hinzu, falls nötig
    }
    return economyData[userId];
};

/**
 * Fügt einem Benutzer einen Gegenstand ins Inventar hinzu.
 * @param {string} userId - Die ID des Benutzers.
 * @param {string} itemId - Die ID/Name des Gegenstands.
 * @param {number} [quantity=1] - Die Menge des Gegenstands.
 */
const addItemToInventory = (userId, itemId, quantity = 1) => {
    const economyData = loadEconomy();
    const userData = getUserData(userId, economyData); // Holt oder initialisiert Benutzerdaten

    userData.inventory[itemId] = (userData.inventory[itemId] || 0) + quantity;
    saveEconomy(economyData);
};

/**
 * Entfernt einen Gegenstand aus dem Inventar eines Benutzers.
 * @param {string} userId - Die ID des Benutzers.
 * @param {string} itemId - Die ID/Name des Gegenstands.
 * @param {number} [quantity=1] - Die Menge des Gegenstands.
 * @returns {boolean} True, wenn der Gegenstand entfernt wurde, false sonst.
 */
const removeItemFromInventory = (userId, itemId, quantity = 1) => {
    const economyData = loadEconomy();
    const userData = getUserData(userId, economyData); // Holt oder initialisiert Benutzerdaten

    if (userData.inventory[itemId] && userData.inventory[itemId] >= quantity) {
        userData.inventory[itemId] -= quantity;
        if (userData.inventory[itemId] <= 0) {
            delete userData.inventory[itemId]; // Entferne den Gegenstand, wenn die Menge 0 oder weniger ist
        }
        saveEconomy(economyData);
        return true;
    }
    return false; // Gegenstand nicht gefunden oder nicht genug vorhanden
};

module.exports = {
    loadEconomy,
    saveEconomy,
    getUserData,
    addItemToInventory,
    removeItemFromInventory
};