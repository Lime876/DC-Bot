// commands/utility/weather.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

export default {
  data: new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Zeigt das aktuelle Wetter für eine angegebene Stadt an.')
    .setDescriptionLocalizations({
      de: getTranslatedText('de', 'weather_command.DESCRIPTION'),
      'en-US': getTranslatedText('en', 'weather_command.DESCRIPTION'),
    })
    .addStringOption(option =>
      option.setName('city')
        .setDescription('Der Name der Stadt.')
        .setDescriptionLocalizations({
          de: getTranslatedText('de', 'weather_command.CITY_OPTION_DESCRIPTION'),
          'en-US': getTranslatedText('en', 'weather_command.CITY_OPTION_DESCRIPTION'),
        })
        .setRequired(true)
    ),

  category: 'Utility',

  async execute(interaction) {
    const lang = await getGuildLanguage(interaction.guildId);
    const city = interaction.options.getString('city');

    await interaction.deferReply({ flags: 64 }); // 64 = ephemeral

    if (!OPENWEATHER_API_KEY) {
      logger.error('[Weather Command] OPENWEATHER_API_KEY fehlt.');
      return interaction.editReply({
        content: getTranslatedText(lang, 'bot_messages.api_key_missing')
      });
    }

    try {
      // Geocoding
      const geoRes = await axios.get(
        `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${OPENWEATHER_API_KEY}`
      );
      const geo = geoRes.data?.[0];
      if (!geo?.lat || !geo?.lon) {
        return interaction.editReply({
          content: getTranslatedText(lang, 'weather_command.weather_no_coords', { city })
        });
      }

      const { lat, lon, name, country } = geo;

      // Wetterdaten abrufen
      const weatherRes = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=${lang}&appid=${OPENWEATHER_API_KEY}`
      );
      const weatherData = weatherRes.data;

      if (weatherData.cod !== 200) {
        logger.error(`[Weather Command] API-Fehler ${city}: ${weatherData.message}`);
        return interaction.editReply({
          content: getTranslatedText(lang, 'weather_command.weather_api_error', {
            errorMessage: weatherData.message || getTranslatedText(lang, 'general.UNKNOWN_ERROR'),
          })
        });
      }

      const { main, weather, wind, sys } = weatherData;
      const weatherDesc = weather?.[0]?.description || getTranslatedText(lang, 'general.NOT_AVAILABLE');

      // Locale-Code holen + Fallback
      let locale = getTranslatedText(lang, 'general_settings.current_locale_code');
      if (typeof locale !== 'string' || !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale)) {
        locale = lang === 'de' ? 'de-DE' : 'en-US';
      }

      const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
      const sunrise = new Date(sys.sunrise * 1000).toLocaleTimeString(locale, timeOptions);
      const sunset = new Date(sys.sunset * 1000).toLocaleTimeString(locale, timeOptions);

      const embed = new EmbedBuilder()
        .setColor(0x00AE86)
        .setTitle(getTranslatedText(lang, 'weather_command.weather_title', { city: name, country }))
        .setDescription(
          getTranslatedText(lang, 'weather_command.weather_description', {
            weatherDescription: weatherDesc.charAt(0).toUpperCase() + weatherDesc.slice(1),
          })
        )
        .setThumbnail(`http://openweathermap.org/img/wn/${weather?.[0]?.icon}.png`)
        .addFields(
          { name: getTranslatedText(lang, 'weather_command.weather_temp'), value: `${main.temp.toFixed(1)}°C ${getTranslatedText(lang, 'weather_command.weather_feels_like', { feelsLike: main.feels_like.toFixed(1) })}`, inline: true },
          { name: getTranslatedText(lang, 'weather_command.weather_humidity'), value: `${main.humidity}%`, inline: true },
          { name: getTranslatedText(lang, 'weather_command.weather_wind'), value: `${(wind.speed * 3.6).toFixed(1)} km/h`, inline: true },
          { name: getTranslatedText(lang, 'weather_command.weather_max_temp'), value: `${main.temp_max.toFixed(1)}°C`, inline: true },
          { name: getTranslatedText(lang, 'weather_command.weather_min_temp'), value: `${main.temp_min.toFixed(1)}°C`, inline: true },
          { name: getTranslatedText(lang, 'weather_command.weather_pressure'), value: `${main.pressure} hPa`, inline: true },
          { name: getTranslatedText(lang, 'weather_command.weather_sunrise'), value: sunrise, inline: true },
          { name: getTranslatedText(lang, 'weather_command.weather_sunset'), value: sunset, inline: true },
        )
        .setTimestamp()
        .setFooter({ text: 'Powered by OpenWeatherMap' });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.error(`[Weather Command] Fehler für Stadt ${city}:`, error);
      if (axios.isAxiosError(error) && error.response) {
        await interaction.editReply({
          content: getTranslatedText(lang, 'weather_command.WEATHER_API_ERROR_GENERIC', {
            errorMessage: error.response.data?.message || error.message,
          })
        });
      } else {
        await interaction.editReply({
          content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED')
        });
      }
    }
  },
};