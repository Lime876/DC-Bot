// utils/watcher.js – ESM-Version
import chokidar from 'chokidar';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirname und __filename in ESM nachbilden
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const watcherLogger = {
  info: (...args) => console.log('[Watcher]', ...args),
  warn: (...args) => console.warn('[Watcher]', ...args),
  error: (...args) => console.error('[Watcher]', ...args),
  debug: (...args) => console.log('[Watcher Debug]', ...args)
};

const scriptPath = path.resolve(process.cwd(), 'index.js');
let botProcess = null;

function startBotProcess() {
  if (botProcess) {
    watcherLogger.info('🛑 Beende bestehenden Bot-Prozess...');
    botProcess.kill('SIGTERM');
    botProcess = null;
  }

  watcherLogger.info('🚀 Starte neuen Bot-Prozess...');
  botProcess = spawn('node', [scriptPath], {
    stdio: 'inherit',
    env: process.env
  });

  botProcess.on('close', (code, signal) => {
    watcherLogger.info(`Bot beendet. Code: ${code}, Signal: ${signal}`);
    botProcess = null;
    if (signal !== 'SIGTERM' && code !== 0) {
      watcherLogger.warn('Unerwartetes Ende. Neustart in 1 Sekunde...');
      setTimeout(startBotProcess, 1000);
    }
  });

  botProcess.on('error', (err) => {
    watcherLogger.error('Fehler im Bot-Prozess:', err);
  });
}

// 📂 Beobachte nur Commands-Ordner (+ optional weitere)
// Hier kannst du bei Bedarf weitere Pfade hinzufügen
const watcher = chokidar.watch([
  './commands/**/*.js'
], {
  ignored: /(^|[\/\\])\../,
  persistent: true,
  ignoreInitial: true
});

watcher
  .on('ready', () => {
    watcherLogger.info('👀 Watcher gestartet. Starte Bot...');
    startBotProcess();
  })
  .on('change', (filePath) => {
    watcherLogger.info(`🔄 Änderung erkannt: ${filePath}`);
    startBotProcess();
  })
  .on('add', (filePath) => {
    watcherLogger.info(`➕ Datei hinzugefügt: ${filePath}`);
    startBotProcess();
  })
  .on('unlink', (filePath) => {
    watcherLogger.info(`🗑️ Datei entfernt: ${filePath}`);
    startBotProcess();
  })
  .on('error', (error) => watcherLogger.error(`Watcher-Fehler: ${error}`));

// 🛑 Sauberes Beenden bei STRG+C oder Kill
['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, async () => {
    watcherLogger.info(`🛑 ${signal} empfangen. Stoppe Watcher & Bot-Prozess...`);
    await watcher.close();
    if (botProcess) botProcess.kill('SIGTERM');
    process.exit(0);
  });
});