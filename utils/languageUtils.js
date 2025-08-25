// languageUtils.js
import fs from 'node:fs/promises'; // Verwende die asynchrone fs/promises-API
import path from 'node:path';
import logger from './logger.js';

const languagesPath = path.resolve('./locales');
const guildLanguagesConfigPath = path.join('./data', 'guildLanguages.json');

const translations = {};
let guildLanguages = {};
const defaultLanguage = process.env.DEFAULT_LANGUAGE || 'en';

/**
 * Lädt alle Übersetzungsdateien aus dem 'locales'-Ordner asynchron.
 */
async function loadTranslations() {
    logger.debug(`[LanguageUtils DEBUG] Checking if languages directory exists: ${languagesPath}`);
    try {
        const filesInDir = await fs.readdir(languagesPath);
        for (const file of filesInDir) {
            if (file.endsWith('.json')) {
                const langCode = file.replace('.json', '');
                const filePath = path.join(languagesPath, file);
                try {
                    const fileContent = await fs.readFile(filePath, 'utf8');
                    translations[langCode] = JSON.parse(fileContent);
                    logger.info(`[LanguageUtils] Loaded translations for ${langCode}. Keys loaded: ${Object.keys(translations[langCode]).length} top-level keys.`);
                } catch (e) {
                    logger.error(`[LanguageUtils] Error loading or parsing language file ${file} at ${filePath}:`, e);
                }
            }
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.error(`[LanguageUtils] Languages directory not found: ${languagesPath}`);
        } else {
            logger.error(`[LanguageUtils] Unexpected error reading languages directory:`, error);
        }
    }
}

/**
 * Lädt die Konfiguration der Gildensprachen asynchron.
 */
async function loadGuildLanguages() {
    try {
        const data = await fs.readFile(guildLanguagesConfigPath, 'utf8');
        guildLanguages = JSON.parse(data);
        logger.info(`[LanguageUtils] Loaded guild language configuration.`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.warn(`[LanguageUtils] guildLanguages.json not found at ${guildLanguagesConfigPath}. Starting with empty guild language config.`);
            guildLanguages = {};
        } else {
            logger.error(`[LanguageUtils] Error loading or parsing guildLanguages.json:`, error);
            guildLanguages = {};
        }
    }
}

/**
 * Gibt die Sprache einer Gilde zurück.
 * @param {string} guildId Die ID der Gilde.
 * @returns {string} Der Sprachcode.
 */
function getGuildLanguage(guildId) {
    return guildLanguages[guildId] || defaultLanguage;
}

/**
 * Holt den übersetzten Text für einen bestimmten Schlüssel.
 * @param {string} langCode Der Sprachcode.
 * @param {string} key Der Schlüssel (z. B. 'spam_command.ENABLED_SUCCESS').
 * @param {object} [replacements={}] Ersetzungen für Platzhalter.
 * @returns {string} Der übersetzte Text oder der Schlüssel, wenn nicht gefunden.
 */
function getTranslatedText(langCode, key, replacements = {}) {
    // Versuche, die spezifische Sprache zu verwenden
    let lang = translations[langCode] || translations[defaultLanguage];

    // Wenn keine Sprache geladen wurde, gib den Schlüssel zurück
    if (!lang) {
        logger.warn(`[LanguageUtils] No translations loaded for '${langCode}' or default. Returning key: ${key}`);
        return key;
    }

    const keys = key.split('.');
    let text = lang;

    for (let i = 0; i < keys.length; i++) {
        if (text && typeof text === 'object' && text.hasOwnProperty(keys[i])) {
            text = text[keys[i]];
        } else {
            text = undefined;
            break;
        }
    }

    // Fallback auf die Standardsprache, wenn der Schlüssel in der Zielsprache nicht gefunden wird
    if (text === undefined && langCode !== defaultLanguage) {
        let defaultLangText = translations[defaultLanguage];
        if (defaultLangText) {
            let tempText = defaultLangText;
            for (let i = 0; i < keys.length; i++) {
                if (tempText && typeof tempText === 'object' && tempText.hasOwnProperty(keys[i])) {
                    tempText = tempText[keys[i]];
                } else {
                    tempText = undefined;
                    break;
                }
            }
            if (tempText !== undefined) {
                text = tempText;
            }
        }
    }

    // Wenn immer noch kein Text gefunden wird, gib den Schlüssel zurück
    if (text === undefined) {
        logger.warn(`[LanguageUtils] Translation key '${key}' not found in '${langCode}' or default. Returning key.`);
        return key;
    }

    if (typeof text === 'object' && text !== null) {
        logger.warn(`[LanguageUtils] Key '${key}' does not resolve to a string. Found an object.`);
        return key; // Gibt den Schlüssel zurück, um Fehler zu vermeiden
    }

    // Ersetze Platzhalter
    if (typeof text === 'string') {
        for (const placeholder in replacements) {
            const regex = new RegExp(`{${placeholder}}`, 'g');
            text = text.replace(regex, replacements[placeholder]);
        }
    }

    return text;
}

/**
 * Setzt die Sprache für eine Gilde und speichert die Konfiguration asynchron.
 * @param {string} guildId Die ID der Gilde.
 * @param {string} langCode Der Sprachcode.
 * @returns {Promise<boolean>} 'true' bei Erfolg, 'false' bei Misserfolg.
 */
async function setGuildLanguage(guildId, langCode) {
    if (!translations[langCode]) {
        logger.warn(`[LanguageUtils] Attempted to set unsupported language code '${langCode}' for guild ${guildId}.`);
        return false;
    }

    guildLanguages[guildId] = langCode;
    try {
        const dir = path.dirname(guildLanguagesConfigPath);
        await fs.mkdir(dir, {
            recursive: true
        });
        await fs.writeFile(guildLanguagesConfigPath, JSON.stringify(guildLanguages, null, 2), 'utf8');
        logger.info(`[LanguageUtils] Guild language for guild ${guildId} set to '${langCode}' and saved.`);
        return true;
    } catch (e) {
        logger.error(`[LanguageUtils] Error saving guild language for guild ${guildId}:`, e);
        return false;
    }
}

// Exportiere alles in einer einzigen Anweisung am Ende der Datei
export { translations, loadTranslations, loadGuildLanguages, getGuildLanguage, getTranslatedText, setGuildLanguage };
