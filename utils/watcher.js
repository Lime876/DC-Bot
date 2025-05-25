// watcher.js
const chokidar = require('chokidar');
const { spawn } = require('child_process');

let botProcess;

function startBot() {
  if (botProcess) botProcess.kill();
  botProcess = spawn('node', ['index.js'], { stdio: 'inherit' });
}

const watcher = chokidar.watch(['./commands', './events'], {
  ignored: /(^|[\/\\])\../, // ignoriert versteckte Dateien
  persistent: true
});

watcher.on('change', (path) => {
  console.log(`🔁 Datei geändert: ${path}`);
  startBot();
});

startBot();