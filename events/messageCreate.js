// events/messageCreate.js
const { Events, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const levelsPath = path.join(__dirname, '../data/levels.json');
const levelRolesPath = path.join(__dirname, '../data/levelRoles.json'); // NEU: Pfad zur Level-Rollen-Datei
const cooldowns = new Set(); 

// XP-Einstellungen (bleiben wie zuvor)
const BASE_XP_PER_MESSAGE = 10;
const XP_PER_CHARACTER = 0.5;
const COOLDOWN_SECONDS = 30;
const MIN_MESSAGE_LENGTH = 8;

// Funktion zum Laden/Speichern der Leveldaten (bleibt wie zuvor)
const loadLevels = () => {
    if (fs.existsSync(levelsPath)) {
        try {
            return JSON.parse(fs.readFileSync(levelsPath, 'utf8'));
        } catch (e) {
            console.error(`Fehler beim Parsen von ${levelsPath}:`, e);
            return {};
        }
    }
    return {};
};

const saveLevels = (levels) => {
    try {
        fs.writeFileSync(levelsPath, JSON.stringify(levels, null, 2));
    } catch (e) {
        console.error(`Fehler beim Schreiben in ${levelsPath}:`, e);
    }
};

// NEU: Funktion zum Laden der Level-Rollen-Daten
const loadLevelRoles = () => {
    if (fs.existsSync(levelRolesPath)) {
        try {
            return JSON.parse(fs.readFileSync(levelRolesPath, 'utf8'));
        } catch (e) {
            console.error(`Fehler beim Parsen von ${levelRolesPath}:`, e);
            return {};
        }
    }
    return {};
};


// Funktion zur Berechnung der benötigten XP für ein bestimmtes Level (bleibt wie zuvor)
const getRequiredXP = (level) => {
    return 5 * Math.pow(level, 2) + 50 * level + 100;
};

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot || !message.guild || message.content.length === 0) return;
        if (message.content.length < MIN_MESSAGE_LENGTH || message.content.trim().length === 0) return;
        if (cooldowns.has(message.author.id)) return;

        const levelsData = loadLevels();
        const levelRolesData = loadLevelRoles(); // NEU: Level-Rollen laden
        const userId = message.author.id;
        const guildId = message.guild.id;

        if (!levelsData[userId]) {
            levelsData[userId] = { xp: 0, level: 0 };
        }

        const oldLevel = levelsData[userId].level; // Altes Level speichern

        let earnedXP = BASE_XP_PER_MESSAGE + (message.content.length * XP_PER_CHARACTER);
        earnedXP = Math.round(earnedXP);

        levelsData[userId].xp += earnedXP;

        let currentLevel = levelsData[userId].level;
        let requiredXP = getRequiredXP(currentLevel);

        while (levelsData[userId].xp >= requiredXP) {
            levelsData[userId].level++;
            levelsData[userId].xp -= requiredXP;
            currentLevel = levelsData[userId].level;
            requiredXP = getRequiredXP(currentLevel);

            // Level-Up Nachricht
            const levelUpEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🎉 Level Up!')
                .setDescription(`Herzlichen Glückwunsch, <@${userId}>! Du hast Level **${currentLevel}** erreicht!`)
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                .setTimestamp();

            // Save levels immediately after level up before sending message
            saveLevels(levelsData);

            await message.channel.send({ embeds: [levelUpEmbed] });
            console.log(`${message.author.tag} hat Level ${currentLevel} erreicht!`);
        }

        // NEU: Rollenvergabe überprüfen, wenn sich das Level geändert hat
        if (levelsData[userId].level > oldLevel) {
            const member = message.member; // Den Member-Objekt des Absenders erhalten
            const rolesForGuild = levelRolesData[guildId];

            if (rolesForGuild && rolesForGuild.length > 0) {
                // Iteriere durch alle konfigurierten Level-Rollen
                for (const lr of rolesForGuild) {
                    // Wenn der Benutzer das erforderliche Level erreicht oder überschritten hat
                    if (levelsData[userId].level >= lr.level) {
                        try {
                            const role = message.guild.roles.cache.get(lr.roleId);
                            if (role && !member.roles.cache.has(role.id)) {
                                await member.roles.add(role, `Level ${lr.level} erreicht.`);
                                console.log(`Rolle ${role.name} an ${member.user.tag} vergeben (Level ${levelsData[userId].level}).`);
                                // Optional: Bestätigungsnachricht für die Rollenvergabe
                                // message.channel.send(`🎉 <@${userId}> hat die Rolle <@&${role.id}> für Level ${lr.level} erhalten!`);
                            }
                        } catch (error) {
                            console.error(`Fehler beim Zuweisen der Rolle ${lr.roleId} an ${member.user.tag}:`, error);
                            // Optional: Administrator benachrichtigen, wenn Bot keine Berechtigung hat
                        }
                    } else {
                        // Optional: Rolle entfernen, wenn Level unterschritten wird (falls gewünscht)
                        // Beachte: Das Entfernen von Rollen bei Level-Verlust ist komplexer, da XP abgezogen werden müssten.
                        // Für ein einfaches System reicht es, nur zuzuweisen.
                    }
                }
            }
        }

        saveLevels(levelsData);

        cooldowns.add(userId);
        setTimeout(() => {
            cooldowns.delete(userId);
        }, COOLDOWN_SECONDS * 1000);
    },
};