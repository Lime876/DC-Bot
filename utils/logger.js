/**
 * Einfaches Logging-Modul mit verschiedenen Leveln.
 */

export const info = (...args) => console.log('[INFO]', ...args);
export const warn = (...args) => console.warn('[WARN]', ...args);
export const error = (...args) => console.error('[ERROR]', ...args);
export const debug = (...args) => console.debug('[DEBUG]', ...args);

// ⬇️ Default-Export für den gewohnten logger.info() Stil
export default { info, warn, error, debug };