// utils/sharedState.js
// Dies ist eine zentrale Datei für gemeinsam genutzten Zustand zwischen verschiedenen Modulen.

/**
 * @type {Set<string>} Ein Set, das die IDs von Nachrichten speichert, die vom Spam-Filter gelöscht wurden.
 * Wird verwendet, um doppelte Logs im messageDelete-Event zu vermeiden.
 */
const spamDeletedMessageIds = new Set();

/**
 * @type {Map<string, Array<{ content: string, timestamp: number, authorId: string, messageId: string }>>}
 * Eine Map, die die letzten Nachrichten pro Gilde speichert, um Raid-Angriffe zu erkennen.
 * Schlüssel: guildId
 * Wert: Array von Nachrichtenobjekten
 */
const recentMessages = new Map();

/**
 * @type {Set<string>} Ein Set, das die IDs von Sprachkanälen speichert, die vom JTC-System erstellt wurden.
 * Wird verwendet, um nur diese Kanäle zu löschen, wenn sie leer werden.
 */
const activeJTCChannels = new Set();

module.exports = {
    spamDeletedMessageIds,
    recentMessages,
    activeJTCChannels
};
