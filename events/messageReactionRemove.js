// events/messageReactionRemove.js
import { Events, PermissionsBitField } from 'discord.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getGuildLanguage, getTranslatedText } from '../utils/languageUtils.js';
import logger from '../utils/logger.js';

const CONFIG_PATH = path.resolve('./data/reactionRolesConfig.json');
let reactionRolesConfig = new Map();

async function loadConfig() {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf8');
    reactionRolesConfig = new Map(Object.entries(JSON.parse(data)));
    logger.debug('[ReactionRoles] Config geladen.');
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.warn('[ReactionRoles] Config nicht gefunden, erstelle leere.');
      reactionRolesConfig = new Map();
      await saveConfig();
    } else {
      logger.error('[ReactionRoles] Fehler beim Laden der Config:', error);
      reactionRolesConfig = new Map();
    }
  }
}

async function saveConfig(configs = reactionRolesConfig) {
  try {
    await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
    await fs.writeFile(CONFIG_PATH, JSON.stringify(Object.fromEntries(configs), null, 2), 'utf8');
    logger.debug('[ReactionRoles] Config gespeichert.');
  } catch (e) {
    logger.error(`[ReactionRoles] Fehler beim Speichern der Config:`, e);
  }
}

await loadConfig();

export default {
  name: Events.MessageReactionRemove,
  async execute(reaction, user) {
    if (reaction.partial) {
      try { await reaction.fetch(); } catch (e) { logger.error('[ReactionRoles] Fehler beim Fetchen der Reaktion:', e); return; }
    }
    if (user.partial) {
      try { await user.fetch(); } catch (e) { logger.error('[ReactionRoles] Fehler beim Fetchen des Benutzers:', e); return; }
    }
    if (user.bot) return;

    const guild = reaction.message.guild;
    if (!guild) return;

    const lang = await getGuildLanguage(guild.id);
    const guildConfig = reactionRolesConfig.get(guild.id);
    if (!guildConfig) {
      logger.debug(`[ReactionRoles] Keine Konfig für Gilde ${guild.id}.`);
      return;
    }

    const messageId = reaction.message.id;
    const emojiId = reaction.emoji.id || reaction.emoji.name;

    if (guildConfig[messageId]?.roles?.[emojiId]) {
      const roleId = guildConfig[messageId].roles[emojiId];
      const member = await guild.members.fetch(user.id).catch(() => null);
      const role = guild.roles.cache.get(roleId);

      if (!member) {
        logger.warn(`[ReactionRoles] Mitglied ${user.tag} nicht in Gilde ${guild.id} gefunden.`);
        return;
      }
      if (!role) {
        logger.warn(`[ReactionRoles] Rolle ${roleId} nicht gefunden, entferne aus Config.`);
        const updatedConfig = { ...guildConfig };
        delete updatedConfig[messageId].roles[emojiId];
        if (Object.keys(updatedConfig[messageId].roles).length === 0) delete updatedConfig[messageId];
        reactionRolesConfig.set(guild.id, updatedConfig);
        await saveConfig();
        return;
      }

      const botMember = guild.members.me;
      if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        logger.error(`[ReactionRoles] Bot hat keine Berechtigung 'Rollen verwalten' in Gilde ${guild.id}.`);
        return;
      }
      if (botMember.roles.highest.position <= role.position) {
        logger.error(`[ReactionRoles] Bot-Rolle ist zu niedrig, um Rolle ${role.name} zu entfernen.`);
        return;
      }

      try {
        await member.roles.remove(role);
        logger.info(`[ReactionRoles] Rolle '${role.name}' von ${user.tag} entfernt in Gilde ${guild.name}.`);
      } catch (error) {
        logger.error(`[ReactionRoles] Fehler beim Entfernen der Rolle '${role.name}' von ${user.tag}:`, error);
      }
    } else {
      logger.debug(`[ReactionRoles] Entfernte Reaktion von nicht konfigurierter Rolle: Nachricht ${messageId}, Emoji ${emojiId}.`);
    }
  },
};
