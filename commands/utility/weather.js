const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const { getGuildLanguage, getTranslatedText } = require('../../utils/languageUtils'); // Importiere getGuildLanguage und getTranslatedText

// API-Schlüssel aus Umgebungsvariablen laden (Stelle sicher, dass du eine .env Datei hast und diese geladen wird)
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weather')
        .setDescription('Zeigt das aktuelle Wetter für eine angegebene Stadt an.')
        .addStringOption(option =>
            option.setName('city')
                .setDescription('Der Name der Stadt.')
                .setRequired(true)),

    category: 'Utility', // Oder die Kategorie, in der du es hast

    async execute(interaction) {
        // Holen der Gilden-ID und der Sprache für diese Gilde
        const guildId = interaction.guildId;
        const lang = getGuildLanguage(guildId); // This will return 'en' or 'de' based on guildLanguages.json

        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }); // Verzögerte Antwort, da API-Anfragen dauern können

        const city = interaction.options.getString('city');

        // Überprüfen, ob der API-Schlüssel vorhanden ist
        if (!OPENWEATHER_API_KEY) {
            console.error('OPENWEATHER_API_KEY ist in den Umgebungsvariablen nicht gesetzt.');
            return interaction.editReply({
                // Verwende die korrekte, verschachtelte Schlüsselstruktur
                content: getTranslatedText(lang, 'bot_messages.api_key_missing'),
                flags: [MessageFlags.Ephemeral]
            });
        }

        try {
            // Schritt 1: Geocoding API, um Koordinaten für die Stadt zu erhalten
            const geoResponse = await axios.get(`http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${OPENWEATHER_API_KEY}`);
            const geoData = geoResponse.data;

            if (!geoData || geoData.length === 0 || !geoData[0] || !geoData[0].lat || !geoData[0].lon) {
                return interaction.editReply({
                    // Verwende die korrekte, verschachtelte Schlüsselstruktur
                    content: getTranslatedText(lang, 'weather_command.weather_no_coords', { city: city }),
                    flags: [MessageFlags.Ephemeral]
                });
            }

            const { lat, lon, name, country } = geoData[0]; // Name und Land aus Geocoding für bessere Anzeige

            // Schritt 2: Weather API, um Wetterdaten mit den Koordinaten zu erhalten
            // 'units=metric' für Celsius, 'lang=' für die Sprache der Beschreibung
            // Hier nutzen wir 'lang' direkt, das 'en' oder 'de' sein sollte
            const weatherResponse = await axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=${lang}&appid=${OPENWEATHER_API_KEY}`);
            const weatherData = weatherResponse.data;

            if (weatherData.cod !== 200) {
                console.error('OpenWeatherMap API Fehler:', weatherData.message);
                return interaction.editReply({
                    // Verwende die korrekte, verschachtelte Schlüsselstruktur
                    content: getTranslatedText(lang, 'weather_command.weather_api_error', { errorMessage: weatherData.message || 'Unbekannter Fehler' }),
                    flags: [MessageFlags.Ephemeral]
                });
            }

            const { main, weather, wind, sys } = weatherData;
            const weatherDescription = weather[0] ? weather[0].description : 'N/A'; // Wetterbeschreibung

            // --- WICHTIG: Locale und Formatierungsoptionen aus den Übersetzungen abrufen ---
            const locale = getTranslatedText(lang, 'general_settings.current_locale_code'); // Holt z.B. 'en-US'
            const timeOptions = getTranslatedText(lang, 'weather_command.time_format_options'); // Holt das Optionen-Objekt


            // Zeitstempel für Sonnenauf- und -untergang umwandeln
            // Stelle sicher, dass locale und timeOptions gültige Werte sind
            const sunriseTime = new Date(sys.sunrise * 1000).toLocaleTimeString(locale, timeOptions);
            const sunsetTime = new Date(sys.sunset * 1000).toLocaleTimeString(locale, timeOptions);

            const weatherEmbed = new EmbedBuilder()
                .setColor(0x00AE86) // Eine nette grüne Farbe
                .setTitle(getTranslatedText(lang, 'weather_command.weather_title', { city: name, country: country }))
                .setDescription(getTranslatedText(lang, 'weather_command.weather_description', { weatherDescription: weatherDescription.charAt(0).toUpperCase() + weatherDescription.slice(1) })) // Erster Buchstabe groß
                .setThumbnail(`http://openweathermap.org/img/wn/${weather[0].icon}.png`) // Wetter-Icon
                .addFields(
                    { name: getTranslatedText(lang, 'weather_command.weather_temp'), value: `${main.temp.toFixed(1)}°C ${getTranslatedText(lang, 'weather_command.weather_feels_like', { feelsLike: main.feels_like.toFixed(1)})}`, inline: true },
                    { name: getTranslatedText(lang, 'weather_command.weather_humidity'), value: `${main.humidity}%`, inline: true },
                    { name: getTranslatedText(lang, 'weather_command.weather_wind'), value: `${(wind.speed * 3.6).toFixed(1)} km/h`, inline: true }, // m/s zu km/h
                    { name: getTranslatedText(lang, 'weather_command.weather_max_temp'), value: `${main.temp_max.toFixed(1)}°C`, inline: true },
                    { name: getTranslatedText(lang, 'weather_command.weather_min_temp'), value: `${main.temp_min.toFixed(1)}°C`, inline: true },
                    { name: getTranslatedText(lang, 'weather_command.weather_pressure'), value: `${main.pressure} hPa`, inline: true },
                    { name: getTranslatedText(lang, 'weather_command.weather_sunrise'), value: sunriseTime, inline: true },
                    { name: getTranslatedText(lang, 'weather_command.weather_sunset'), value: sunsetTime, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Powered by OpenWeatherMap' });

            await interaction.editReply({ embeds: [weatherEmbed], flags: [MessageFlags.Ephemeral] });

        } catch (error) {
            console.error('Fehler beim Abrufen der Wetterdaten:', error);
            await interaction.editReply({
                // Verwende die korrekte, verschachtelte Schlüsselstruktur
                content: getTranslatedText(lang, 'weather_command.weather_generic_error'),
                flags: [MessageFlags.Ephemeral]
            });
        }
    },
};