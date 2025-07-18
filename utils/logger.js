// utils/logger.js
// Ein einfaches Logging-Modul, das console.log, console.warn und console.error umschließt.

module.exports = {
    /**
     * Loggt eine Informationsnachricht.
     * @param {...any} args - Die zu loggenden Argumente.
     */
    info: (...args) => console.log('[INFO]', ...args),

    /**
     * Loggt eine Warnung.
     * @param {...any} args - Die zu loggenden Argumente.
     */
    warn: (...args) => console.warn('[WARN]', ...args),

    /**
     * Loggt einen Fehler.
     * @param {...any} args - Die zu loggenden Argumente.
     */
    error: (...args) => console.error('[ERROR]', ...args),

    /**
     * Loggt eine Debug-Nachricht.
     * @param {...any} args - Die zu loggenden Argumente.
     */
    debug: (...args) => console.debug('[DEBUG]', ...args),
};
