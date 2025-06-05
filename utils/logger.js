const fs = require('fs');
const path = require('path');
const moment = require('moment'); // Moment.js für Zeitstempel

// Definiere den Pfad zur Log-Datei
const logFilePath = path.join(__dirname, '../bot.log'); // Log-Datei im Hauptverzeichnis

/**
 * Schreibt eine Log-Nachricht in die Log-Datei und auf die Konsole.
 * Diese Funktion ist NICHT für das Senden von Nachrichten an Discord-Kanäle zuständig.
 * @param {string} message Die zu loggende Nachricht.
 * @param {string} level Der Log-Level (z.B. 'INFO', 'WARN', 'ERROR', 'DEBUG'). Standard ist 'INFO'.
 */
const sendLog = (message, level = 'INFO') => {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss'); // Aktuellen Zeitstempel formatieren
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`; // Format der Log-Nachricht

    // Nachricht in die Log-Datei schreiben
    fs.appendFile(logFilePath, logMessage, (err) => {
        if (err) {
            console.error('Fehler beim Schreiben in die Log-Datei:', err);
        }
    });

    // Nachricht auch auf der Konsole ausgeben
    // Färbung für bessere Lesbarkeit in der Konsole (optional)
    let consoleMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    switch (level.toUpperCase()) {
        case 'INFO':
            console.log(consoleMessage);
            break;
        case 'WARN':
            console.warn(consoleMessage);
            break;
        case 'ERROR':
            console.error(consoleMessage);
            break;
        case 'DEBUG':
            console.debug(consoleMessage);
            break;
        default:
            console.log(consoleMessage);
    }
};

module.exports = {
    sendLog,
};
