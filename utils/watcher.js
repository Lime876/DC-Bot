// watcher.js
const chokidar = require('chokidar');
const { spawn } = require('child_process');

let botProcess; // Hält den aktuellen Bot-Prozess
let isRestarting = false; // Flag, um Mehrfachstarts während eines Neustarts zu verhindern

function startBot() {
    if (isRestarting) return; // Wenn bereits ein Neustart läuft, nichts tun
    isRestarting = true; // Neustart beginnt

    if (botProcess) {
        console.log('🔄 Beende bestehenden Bot-Prozess...');
        // Sende ein SIGTERM-Signal für ein sauberes Herunterfahren
        // Auf Windows kann 'SIGKILL' manchmal zuverlässiger sein, aber SIGTERM ist besser für saubere Exits.
        // Wenn SIGTERM nicht funktioniert, kannst du SIGKILL versuchen, aber das ist weniger elegant.
        botProcess.kill('SIGTERM');

        // Warte, bis der Prozess beendet ist, bevor ein neuer gestartet wird
        botProcess.on('close', (code) => {
            console.log(`✅ Bot-Prozess beendet mit Code: ${code}`);
            spawnNewBotProcess();
        });

        botProcess.on('error', (err) => {
            console.error('⚠️ Fehler beim Beenden des Bot-Prozesses:', err);
            spawnNewBotProcess(); // Versuche trotzdem einen neuen Prozess zu starten
        });

    } else {
        // Erster Start des Bots
        spawnNewBotProcess();
    }
}

function spawnNewBotProcess() {
    console.log('🚀 Starte neuen Bot-Prozess...');
    botProcess = spawn('node', ['index.js'], { stdio: 'inherit' });

    botProcess.on('exit', (code, signal) => {
        // Setze botProcess auf null, wenn der Prozess beendet ist
        // Dies ist wichtig, falls der Bot aus anderen Gründen als einem Neustart beendet wird
        // und um zu vermeiden, dass ein beendeter Prozess erneut gekillt wird.
        if (!isRestarting) { // Nur wenn es KEIN geplanter Neustart war
             console.log(`🤖 Bot-Prozess unerwartet beendet mit Code ${code} und Signal ${signal}.`);
             // Hier könntest du Logik hinzufügen, um den Bot bei Absturz neu zu starten
        }
        botProcess = null;
        isRestarting = false; // Neustart abgeschlossen
    });

    // Optional: Füge einen Error-Handler für den neuen Prozess hinzu
    botProcess.on('error', (err) => {
        console.error('❌ Fehler beim Starten des neuen Bot-Prozesses:', err);
        isRestarting = false;
    });
}


const watcher = chokidar.watch(['./commands', './events', './index.js', './data', './locales'], { // index.js, data und locales auch überwachen
    ignored: /(^|[\/\\])\../, // ignoriert versteckte Dateien
    persistent: true,
    ignoreInitial: true // Wichtig: Feuert beim Start nicht für alle vorhandenen Dateien ein "change"-Event
});

watcher.on('change', (path) => {
    console.log(`🔁 Datei geändert: ${path}`);
    startBot(); // Ruft die überarbeitete Start-Funktion auf
});

watcher.on('add', (path) => { // Auch bei neuen Dateien neu starten
    console.log(`➕ Neue Datei hinzugefügt: ${path}`);
    startBot();
});

watcher.on('unlink', (path) => { // Auch bei gelöschten Dateien neu starten
    console.log(`➖ Datei entfernt: ${path}`);
    startBot();
});


// Initialer Start des Bots, wenn der Watcher gestartet wird
console.log('👀 Starte Dateiwächter und initialen Bot-Start...');
startBot();

// Beende den Bot-Prozess sauber, wenn der Watcher selbst beendet wird (z.B. mit Strg+C)
process.on('SIGINT', () => {
    console.log('\n graceful shutdown des Watchers...');
    if (botProcess) {
        botProcess.kill('SIGTERM'); // Sende SIGTERM an den Bot-Prozess
        botProcess.on('close', () => {
            process.exit(0); // Beende den Watcher-Prozess, nachdem der Bot beendet wurde
        });
    } else {
        process.exit(0);
    }
});