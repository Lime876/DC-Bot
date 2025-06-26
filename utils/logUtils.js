// C:\Users\lucig\OneDrive\Discord Bot\Test\utils\logUtils.js

const chalk = require('chalk'); // Optional: Für farbige Konsolenausgaben
const fs = require('fs');
const path = require('path');

// Pfad zur Logdatei (passen Sie diesen bei Bedarf an)
const logFilePath = path.join(__dirname, '../logs/bot.log');

// Stelle sicher, dass der Log-Ordner existiert
const logDir = path.dirname(logFilePath);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Protokolliert eine Nachricht mit einem bestimmten Level.
 * @param {string} level - Das Protokoll-Level (z.B. 'INFO', 'WARN', 'ERROR', 'DEBUG').
 * @param {string} message - Die zu protokollierende Nachricht.
 * @param {Error|null} [error] - Ein optionales Error-Objekt für detailliertere Protokollierung.
 */
function log(level, message, error = null) {
    const timestamp = new Date().toLocaleString('de-DE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false // 24-Stunden-Format
    });

    let formattedMessage = `[${timestamp}] [${level}] ${message}`;

    // Für Konsolenausgabe mit optionalen Farben
    switch (level) {
        case 'ERROR':
            console.error(chalk.red(formattedMessage));
            if (error) console.error(chalk.red(error.stack || error.message));
            break;
        case 'WARN':
            console.warn(chalk.yellow(formattedMessage));
            break;
        case 'INFO':
            console.log(chalk.blue(formattedMessage));
            break;
        case 'DEBUG':
            console.log(chalk.gray(formattedMessage));
            break;
        default:
            console.log(formattedMessage);
            break;
    }

    // Für Dateiprotokollierung
    fs.appendFile(logFilePath, formattedMessage + '\n', (err) => {
        if (err) {
            console.error(`[LOGGING_ERROR] Fehler beim Schreiben in die Logdatei: ${err.message}`);
        }
    });

    if (error) {
        fs.appendFile(logFilePath, (error.stack || error.message) + '\n', (err) => {
            if (err) {
                console.error(`[LOGGING_ERROR] Fehler beim Schreiben des Fehlers in die Logdatei: ${err.message}`);
            }
        });
    }
}

// Exportieren der Funktionen für die Nutzung in anderen Dateien
module.exports = {
    info: (message) => log('INFO', message),
    warn: (message) => log('WARN', message),
    error: (message, error) => log('ERROR', message, error),
    debug: (message) => log('DEBUG', message),
    // Sie könnten auch eine Raw-Log-Funktion hinzufügen, wenn Sie einfach nur protokollieren möchten, ohne Level
    log: (message) => log('INFO', message), // Alias für info
};