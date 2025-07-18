// utils/languageUtils.js
const fs = require('node:fs'); // Verwende 'node:fs' für Klarheit
const path = require('node:path'); // Verwende 'node:path' für Klarheit
const logger = require('./logger'); // Importiere den Logger

const languagesPath = path.resolve(__dirname, '..', 'locales');
const guildLanguagesConfigPath = path.join(__dirname, '../data/guildLanguages.json');

const translations = {}; // Cache für geladene Sprachen
let guildLanguages = {}; // Cache für Gilden-Sprachkonfigurationen
const defaultLanguage = process.env.DEFAULT_LANGUAGE || 'en'; // Nutze Umgebungsvariable, sonst 'en'

/**
 * Lädt alle Sprachdateien aus dem 'locales'-Verzeichnis.
 */
function loadTranslations() {
    logger.debug(`[LanguageUtils DEBUG] Checking if languages directory exists: ${languagesPath}`);
    if (!fs.existsSync(languagesPath)) {
        logger.error(`[LanguageUtils] Languages directory not found: ${languagesPath}`);
        return;
    }
    logger.debug(`[LanguageUtils DEBUG] Languages directory found: ${languagesPath}`);

    const filesInDir = fs.readdirSync(languagesPath);
    logger.debug(`[LanguageUtils DEBUG] Files found in directory:`, filesInDir);

    filesInDir.forEach(file => {
        if (file.endsWith('.json')) {
            const langCode = file.replace('.json', '');
            const filePath = path.join(languagesPath, file);
            logger.debug(`[LanguageUtils DEBUG] Attempting to load file: ${filePath} for langCode: ${langCode}`);
            try {
                const fileContent = fs.readFileSync(filePath, 'utf8');
                translations[langCode] = JSON.parse(fileContent);
                logger.info(`[LanguageUtils] Loaded translations for ${langCode}. Keys loaded: ${Object.keys(translations[langCode]).length} top-level keys.`);
            } catch (e) {
                logger.error(`[LanguageUtils] Error loading or parsing language file ${file} at ${filePath}:`, e);
            }
        }
    });
    logger.debug(`[LanguageUtils DEBUG] Final translations object after load:`, Object.keys(translations));
}

/**
 * Lädt die Gilden-Sprachkonfiguration aus der Datei.
 */
function loadGuildLanguages() {
    logger.debug(`[LanguageUtils DEBUG] Attempting to load guild languages from: ${guildLanguagesConfigPath}`);
    if (fs.existsSync(guildLanguagesConfigPath)) {
        try {
            guildLanguages = JSON.parse(fs.readFileSync(guildLanguagesConfigPath, 'utf8'));
            logger.info(`[LanguageUtils] Loaded guild language configuration.`);
        } catch (e) {
            logger.error(`[LanguageUtils] Error loading or parsing guildLanguages.json:`, e);
            guildLanguages = {};
        }
    } else {
        logger.warn(`[LanguageUtils] guildLanguages.json not found at ${guildLanguagesConfigPath}. Starting with empty guild language config.`);
        guildLanguages = {};
    }
}

// --- Initialisierung beim Start ---
loadTranslations();
loadGuildLanguages();

// --- Externe Funktionen ---

/**
 * Gibt die Sprache für eine bestimmte Gilde zurück.
 * @param {string} guildId - Die ID der Gilde.
 * @returns {string} Der Sprachcode (z.B. 'en', 'de'). Standard ist 'en'.
 */
function getGuildLanguage(guildId) {
    // Wenn guildLanguages noch nicht geladen ist, lade es jetzt
    if (Object.keys(guildLanguages).length === 0 && !fs.existsSync(guildLanguagesConfigPath)) {
        loadGuildLanguages();
    }
    return guildLanguages[guildId] || defaultLanguage; // Nutze die defaultLanguage Variable
}

/**
 * Ruft einen übersetzten Text ab, unterstützt auch verschachtelte Schlüssel.
 * @param {string} langCode - Der Sprachcode (z.B. 'de', 'en').
 * @param {string} key - Der Schlüssel des Textes in der JSON-Datei (z.B. 'weather_command.weather_title').
 * @param {object} [replacements] - Ein optionales Objekt für Platzhalter.
 * @returns {string|object} Der übersetzte Text, ein Objekt für Formatierungsoptionen, oder der Schlüssel, falls nicht gefunden.
 */
function getTranslatedText(langCode, key, replacements = {}) {
    // Versuche zuerst, die spezifische Sprache zu laden, sonst die Standard-Sprache
    const lang = translations[langCode] || translations[defaultLanguage];

    // Wenn keine Sprache gefunden wurde (weder die angefragte noch die Standard-Sprache)
    if (!lang) {
        logger.error(`[LanguageUtils] No translations object found for '${langCode}' or default language '${defaultLanguage}'. Returning key as fallback: ${key}`);
        return key;
    }

    const keys = key.split('.');
    let text = lang; // Initialisiere 'text' mit dem Sprachobjekt

    // Durchlaufe die Schlüssel, um den verschachtelten Text zu finden
    for (let i = 0; i < keys.length; i++) {
        if (text && typeof text === 'object' && text.hasOwnProperty(keys[i])) {
            text = text[keys[i]];
        } else {
            text = undefined; // Schlüssel nicht gefunden auf dieser Ebene
            break;
        }
    }

    // Wenn der Text immer noch nicht gefunden wurde (undefined)
    if (text === undefined) {
        // Versuche, den Text aus der Standardsprache zu laden, wenn die angefragte Sprache nicht die Standard ist
        if (langCode !== defaultLanguage && translations[defaultLanguage]) {
            let defaultLangText = translations[defaultLanguage];
            for (let i = 0; i < keys.length; i++) {
                if (defaultLangText && typeof defaultLangText === 'object' && defaultLangText.hasOwnProperty(keys[i])) {
                    defaultLangText = defaultLangText[keys[i]];
                } else {
                    defaultLangText = undefined;
                    break;
                }
            }
            if (defaultLangText !== undefined) {
                text = defaultLangText;
                logger.warn(`[LanguageUtils] Key '${key}' not found in language '${langCode}'. Using default language '${defaultLanguage}'.`);
            } else {
                logger.error(`[LanguageUtils] Key '${key}' not found in default language '${defaultLanguage}'. Returning key as fallback: ${key}`);
                return key;
            }
        } else {
            // Wenn es keine Standardsprache gibt oder der Schlüssel auch dort nicht gefunden wurde
            logger.error(`[LanguageUtils] Key '${key}' not found. Returning key as fallback: ${key}`);
            return key;
        }
    }

    // Wenn der gefundene "Text" ein Objekt ist (z.B. ein Unter-JSON), gib es direkt zurück
    if (typeof text === 'object' && text !== null) {
        return text;
    }

    // Wenn der gefundene "Text" ein String ist, ersetze Platzhalter
    if (typeof text === 'string') {
        for (const placeholder in replacements) {
            const regex = new RegExp(`{${placeholder}}`, 'g');
            text = text.replace(regex, replacements[placeholder]);
        }
    }

    return text;
}

/**
 * Speichert die Sprache für eine bestimmte Gilde in guildLanguages.json.
 * @param {string} guildId - Die ID der Gilde.
 * @param {string} langCode - Der zu setzende Sprachcode (z.B. 'en', 'de').
 * @returns {boolean} True bei Erfolg, False bei Misserfolg.
 */
function setGuildLanguage(guildId, langCode) {
    // Check if the chosen language is actually supported by our loaded translations
    if (!translations[langCode]) {
        logger.warn(`[LanguageUtils] Attempted to set unsupported language '${langCode}' for guild ${guildId}.`);
        return false; // Indicate failure
    }

    guildLanguages[guildId] = langCode;
    try {
        const dir = path.dirname(guildLanguagesConfigPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(guildLanguagesConfigPath, JSON.stringify(guildLanguages, null, 2), 'utf8');
        logger.info(`[LanguageUtils] Set language for guild ${guildId} to ${langCode} and saved to config.`);
        return true;
    } catch (e) {
        logger.error(`[LanguageUtils] Error saving guild language for guild ${guildId}:`, e);
        return false;
    }
}

module.exports = {
    getGuildLanguage,
    getTranslatedText,
    loadTranslations,
    loadGuildLanguages,
    setGuildLanguage,
    translations: translations // Behalte dies für den Sprachbefehl
};