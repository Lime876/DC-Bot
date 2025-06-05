const fs = require('fs');
const path = require('path');

const logConfigPath = path.join(__dirname, '../data/logchannels.json');
const ticketConfigPath = path.join(__dirname, '../data/ticketConfig.json');

function getLogChannelId(guildId) {
    if (fs.existsSync(logConfigPath)) {
        const config = JSON.parse(fs.readFileSync(logConfigPath, 'utf8'));
        return config[guildId] || null;
    }
    return null;
}

function setLogChannelId(guildId, channelId) {
    let config = {};
    if (fs.existsSync(logConfigPath)) {
        config = JSON.parse(fs.readFileSync(logConfigPath, 'utf8'));
    }
    config[guildId] = channelId;
    fs.writeFileSync(logConfigPath, JSON.stringify(config, null, 2));
}

function getTicketConfig(guildId) {
    if (fs.existsSync(ticketConfigPath)) {
        const config = JSON.parse(fs.readFileSync(ticketConfigPath, 'utf8'));
        // Wenn ticketConfig.json ein Objekt pro Gilde ist, wie logConfig.json
        // return config[guildId] || null;
        // Wenn es ein einzelnes Objekt für das gesamte Setup ist (wie im vorherigen Beispiel)
        if (config.guildId === guildId) {
            return config;
        }
    }
    return null;
}

function setTicketConfig(configData) {
    // Wenn ticketConfig.json ein Objekt pro Gilde ist
    /*
    let config = {};
    if (fs.existsSync(ticketConfigPath)) {
        config = JSON.parse(fs.readFileSync(ticketConfigPath, 'utf8'));
    }
    config[configData.guildId] = configData;
    fs.writeFileSync(ticketConfigPath, JSON.stringify(config, null, 2));
    */
    // Wenn es ein einzelnes Objekt für das gesamte Setup ist
    fs.writeFileSync(ticketConfigPath, JSON.stringify(configData, null, 2));
}

module.exports = {
    getLogChannelId,
    setLogChannelId,
    getTicketConfig,
    setTicketConfig,
};