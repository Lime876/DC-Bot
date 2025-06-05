// utils/economyUtils.js
const fs = require('fs');
const path = require('path');

const economyPath = path.join(__dirname, '../data/economy.json');
const xpPath = path.join(__dirname, '../data/xp.json'); // Pfad zur XP-Datei

const loadEconomy = () => {
    if (fs.existsSync(economyPath)) {
        try {
            return JSON.parse(fs.readFileSync(economyPath, 'utf8'));
        } catch (e) {
            console.error(`Fehler beim Parsen von ${economyPath}:`, e);
            return {};
        }
    }
    return {};
};

const saveEconomy = (economyData) => {
    try {
        fs.writeFileSync(economyPath, JSON.stringify(economyData, null, 2));
    } catch (e) {
        console.error(`Fehler beim Schreiben in ${economyPath}:`, e);
    }
};

// Hilfsfunktion, um Benutzerdaten zu initialisieren oder abzurufen (Economy)
const getUserData = (userId, economyData) => {
    if (!economyData[userId]) {
        economyData[userId] = {
            balance: 0,
            lastWork: 0,
            lastRob: 0
        };
    }
    return economyData[userId];
};

// --- XP-Funktionen ---
const loadXP = () => {
    if (fs.existsSync(xpPath)) {
        try {
            return JSON.parse(fs.readFileSync(xpPath, 'utf8'));
        } catch (e) {
            console.error(`Fehler beim Parsen von ${xpPath}:`, e);
            return {};
        }
    }
    return {};
};

const saveXP = (xpData) => {
    try {
        fs.writeFileSync(xpPath, JSON.stringify(xpData, null, 2));
    } catch (e) {
        console.error(`Fehler beim Schreiben in ${xpPath}:`, e);
    }
};

// Hilfsfunktion, um XP-Daten zu initialisieren oder abzurufen
const getUserXP = (userId, xpData) => {
    if (!xpData[userId]) {
        xpData[userId] = {
            xp: 0,
            level: 1 // Startlevel
        };
    }
    return xpData[userId];
};


module.exports = {
    loadEconomy,
    saveEconomy,
    getUserData,
    loadXP,  // XP-Funktionen exportieren
    saveXP,
    getUserXP
};