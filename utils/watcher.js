// utils/watcher.js
const chokidar = require('chokidar');
const { spawn } = require('child_process');
const path = require('path');

let botProcess = null; // Speichert die Child-Prozess-Instanz

/**
 * Startet den Bot-Prozess. Beendet einen bestehenden Prozess, falls vorhanden.
 */
function startBot() {
    if (botProcess) {
        console.log('👀 Beende bestehenden Bot-Prozess...');
        // Versuche, den Prozess elegant zu beenden (SIGTERM), dann erzwinge (SIGKILL)
        botProcess.kill('SIGTERM'); 
        // Setze einen Timeout, um den Prozess nach 5 Sekunden zwangsweise zu beenden, falls SIGTERM nicht funktioniert
        setTimeout(() => {
            if (botProcess && !botProcess.killed) {
                console.warn('⚠️ Bot-Prozess wurde nicht elegant beendet. Erzwinge Beendigung...');
                botProcess.kill('SIGKILL');
            }
        }, 5000); // 5 Sekunden Timeout
    }

    console.log('🚀 Starte neuen Bot-Prozess...');
    // Verwende 'inherit', um die Konsolenausgabe des Bots in der Konsole des Watchers zu sehen
    botProcess = spawn('node', [path.join(__dirname, '../index.js')], { stdio: 'inherit' });

    // Event-Listener für das Beenden des Bot-Prozesses
    botProcess.on('exit', (code, signal) => {
        console.log(`Bot-Prozess beendet mit Code ${code} und Signal ${signal}`);
        botProcess = null; // Referenz löschen, wenn der Prozess beendet ist
    });

    // Event-Listener für Fehler beim Starten des Bot-Prozesses
    botProcess.on('error', (err) => {
        console.error('❌ Fehler beim Starten des Bot-Prozesses:', err);
    });
}

// Initialer Start des Bots beim Start des Watchers
startBot();

// Überwache Änderungen in .js- und .json-Dateien, schließe node_modules und data-Ordner aus
const watcher = chokidar.watch(['./**/*.js', './**/*.json', './.env'], {
    ignored: [
        'node_modules', 
        'data', // Ignoriere Änderungen im data-Ordner (z.B. Konfigurationsupdates), um Endlosschleifen zu vermeiden
        '.git', 
        '*.log' // Ignoriere Log-Dateien
    ],
    persistent: true, // Behalte den Watcher am Laufen
    ignoreInitial: true // Löse beim Start keine 'add'-Events aus
});

// Bei einer erkannten Dateiänderung: Bot neu starten
watcher.on('change', (filePath) => {
    console.log(`\n🔄 Datei geändert: ${filePath}. Starte Bot neu...`);
    startBot();
});

// Fehlerbehandlung für den Watcher selbst
watcher.on('error', (error) => console.error('Watcher-Fehler:', error));

console.log('👀 Dateiwächter gestartet. Initialer Bot-Prozess gestartet.');

// Behandle das elegante Beenden des Watchers (z.B. bei Strg+C)
process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT empfangen. Schließe Watcher und Bot-Prozess...');
    if (botProcess) {
        botProcess.kill('SIGTERM');
        setTimeout(() => {
            if (botProcess && !botProcess.killed) {
                botProcess.kill('SIGKILL');
            }
        }, 5000);
    }
    watcher.close(); // Schließe den Dateiwächter
    process.exit(0); // Beende den Watcher-Prozess
});

// Handle SIGTERM (z.B. von Prozessmanagern)
process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM empfangen. Schließe Watcher und Bot-Prozess...');
    if (botProcess) {
        botProcess.kill('SIGTERM');
        setTimeout(() => {
            if (botProcess && !botProcess.killed) {
                botProcess.kill('SIGKILL');
            }
        }, 5000);
    }
    watcher.close();
    process.exit(0);
});
