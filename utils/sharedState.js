 // utils/sharedState.js
 // Gemeinsamer Zustand für ESM-Version

/**
 * @type {Set<string>} Ein Set, das die IDs von Nachrichten speichert, die vom Spam-Filter gelöscht wurden.
 */
export const spamDeletedMessageIds = new Set();

/**
 * @type {Map<string, Array<{ content: string, timestamp: number, authorId: string, messageId: string }>>}
 */
export const recentMessages = new Map();

/**
 * @type {Set<string>} Ein Set, das die IDs von Sprachkanälen speichert, die vom JTC-System erstellt wurden.
 */
export const activeJTCChannels = new Set();
