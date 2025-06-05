const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Bot-Client initialisieren
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Message, Partials.Channel],
});

client.commands = new Map();
client.reactionRoleMappings = new Map(); // Map für Reaktionsrollen

// Hilfsfunktionen laden
const { sendLog } = require('./utils/logger.js');

// Befehle laden + prüfen
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
const loadedCommandNames = new Set();

for (const file of commandFiles) {
  try {
    const command = require(`./commands/${file}`);

    if (!command?.data?.name) {
      throw new Error(`❌ Befehl "${file}" hat keinen Namen!`);
    }

    if (loadedCommandNames.has(command.data.name)) {
      throw new Error(`⚠️ Doppelter Befehl: ${command.data.name}`);
    }

    client.commands.set(command.data.name, command);
    loadedCommandNames.add(command.data.name);
  } catch (error) {
    console.error(`Fehler beim Laden von "${file}":`, error);
    process.exit(1);
  }
}

// Events laden + prüfen
const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));
const loadedEventNames = new Set();

for (const file of eventFiles) {
  try {
    const event = require(`./events/${file}`);

    if (!event?.name) {
      throw new Error(`❌ Event "${file}" hat keinen Namen!`);
    }

    if (loadedEventNames.has(event.name)) {
      throw new Error(`⚠️ Doppeltes Event: ${event.name}`);
    }

    loadedEventNames.add(event.name);

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  } catch (error) {
    console.error(`Fehler beim Laden von Event "${file}":`, error);
    process.exit(1);
  }
}

// Login starten
client.login(process.env.TOKEN);