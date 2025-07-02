const fs = require('fs');
const path = require('path');

const languagesPath = path.resolve(__dirname, '..', 'locales');

const guildLanguagesConfigPath = path.join(__dirname, '../data/guildLanguages.json'); // This path should be correct if guildLanguages.json is directly in 'data'

const translations = {};
let guildLanguages = {};
const defaultLanguage = 'en';

function loadTranslations() {
    console.log(`[LanguageUtils DEBUG] Checking if languages directory exists: ${languagesPath}`);
    if (!fs.existsSync(languagesPath)) {
        console.error(`[LanguageUtils] Languages directory not found: ${languagesPath}`);
        return;
    }
    console.log(`[LanguageUtils DEBUG] Languages directory found: ${languagesPath}`);

    const filesInDir = fs.readdirSync(languagesPath);
    console.log(`[LanguageUtils DEBUG] Files found in directory:`, filesInDir);

    filesInDir.forEach(file => {
        if (file.endsWith('.json')) {
            const langCode = file.replace('.json', '');
            const filePath = path.join(languagesPath, file);
            console.log(`[LanguageUtils DEBUG] Attempting to load file: ${filePath} for langCode: ${langCode}`);
            try {
                const fileContent = fs.readFileSync(filePath, 'utf8');
                translations[langCode] = JSON.parse(fileContent);
                console.log(`[LanguageUtils] Loaded translations for ${langCode}. Keys loaded: ${Object.keys(translations[langCode]).length} top-level keys.`);
            } catch (e) {
                console.error(`[LanguageUtils] Error loading or parsing language file ${file} at ${filePath}:`, e);
            }
        }
    });
    console.log(`[LanguageUtils DEBUG] Final translations object after load:`, Object.keys(translations));
}

function loadGuildLanguages() {
    console.log(`[LanguageUtils DEBUG] Attempting to load guild languages from: ${guildLanguagesConfigPath}`);
    if (fs.existsSync(guildLanguagesConfigPath)) {
        try {
            guildLanguages = JSON.parse(fs.readFileSync(guildLanguagesConfigPath, 'utf8'));
            console.log(`[LanguageUtils] Loaded guild language configuration.`);
        } catch (e) {
            console.error(`[LanguageUtils] Error loading or parsing guildLanguages.json:`, e);
            guildLanguages = {};
        }
    } else {
        console.warn(`[LanguageUtils] guildLanguages.json not found at ${guildLanguagesConfigPath}. Starting with empty guild language config.`);
        guildLanguages = {};
    }
}

// --- Initialisierung beim Start ---
loadTranslations();
loadGuildLanguages();

// --- Externe Funktionen ---

function getGuildLanguage(guildId) {
    const lang = guildLanguages[guildId] || defaultLanguage;
    return lang;
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
        console.error(`[LanguageUtils] No translations object found for ${langCode} or default language ${defaultLanguage}. Returning key as fallback: ${key}`);
        return key;
    }

    const keys = key.split('.');
    let text = lang; // Initialisiere 'text' mit dem Sprachobjekt

    // Durchlaufe die Schlüssel, um den verschachtelten Text zu finden
    for (let i = 0; i < keys.length; i++) {
        if (text && typeof text === 'object' && text.hasOwnProperty(keys[i])) {
            text = text[keys[i]];
        } else {
            // Wenn der Schlüssel auf dieser Ebene nicht gefunden wurde, ist der Text undefined
            text = undefined;
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
                console.warn(`[LanguageUtils] Key '${key}' not found in language '${langCode}'. Using default language '${defaultLanguage}'.`);
            } else {
                console.error(`[LanguageUtils] Key '${key}' not found in default language. Returning key as fallback: ${key}`);
                return key;
            }
        } else {
            // Wenn es keine Standardsprache gibt oder der Schlüssel auch dort nicht gefunden wurde
            console.error(`[LanguageUtils] Key '${key}' not found. Returning key as fallback: ${key}`);
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
 */
function setGuildLanguage(guildId, langCode) {
    // Check if the chosen language is actually supported by our loaded translations
    if (!translations[langCode]) {
        console.warn(`[LanguageUtils] Attempted to set unsupported language '${langCode}' for guild ${guildId}.`);
        return false; // Indicate failure
    }

    guildLanguages[guildId] = langCode;
    try {
        const dir = path.dirname(guildLanguagesConfigPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(guildLanguagesConfigPath, JSON.stringify(guildLanguages, null, 2), 'utf8');
        console.log(`[LanguageUtils] Set language for guild ${guildId} to ${langCode} and saved to config.`);
        return true;
    } catch (e) {
        console.error(`[LanguageUtils] Error saving guild language for guild ${guildId}:`, e);
        return false;
    }
}

module.exports = {
    getGuildLanguage,
    getTranslatedText,
    loadTranslations,
    loadGuildLanguages,
    setGuildLanguage,
    translations: translations // Keep this for now for the language command's check
};