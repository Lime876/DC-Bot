const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path'); // Pfad für den commands-Ordner

require('dotenv').config();

const commands = [];
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(__dirname, 'commands', file));
  if (command.data) { // Stelle sicher, dass 'data' Eigenschaft vorhanden ist
    commands.push(command.data.toJSON());
  } else {
    console.warn(`[WARNUNG] Befehl in ${file} fehlt die 'data' Eigenschaft und wird übersprungen.`);
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('Starte das Aktualisieren/Registrieren der Slash-Commands...');

    // Zuerst alle bestehenden globalen Commands abrufen und löschen
    console.log('Lösche bestehende globale Slash-Commands...');
    const currentCommands = await rest.get(
      Routes.applicationCommands(process.env.CLIENT_ID)
    );
    for (const command of currentCommands) {
      await rest.delete(Routes.applicationCommand(process.env.CLIENT_ID, command.id));
      console.log(`Gelöscht: /${command.name}`);
    }
    console.log('Bestehende Commands erfolgreich gelöscht.');


    // Dann die neuen Commands registrieren
    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log(`✅ Erfolgreich ${data.length} Anwendungs-Commands registriert!`);
  } catch (error) {
    console.error('Fehler beim Registrieren der Commands:', error);
  }
})();