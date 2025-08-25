// commands/services/social/index.js
import { getTwitchStats } from './twitch.js';
import { getTwitterStats } from './twitter.js';
import { getYouTubeStats } from './youtube.js';

export async function getAllSocialStats({ twitch, twitter, youtubeChannelId }) {
  const results = [];

  if (twitter) {
    try {
      const tw = await getTwitterStats(twitter);
      results.push({ platform: 'Twitter', ...tw });
    } catch (e) {
      results.push({ platform: 'Twitter', error: e.message });
    }
  }

  if (youtubeChannelId) {
    try {
      const yt = await getYouTubeStats(youtubeChannelId);
      results.push({ platform: 'YouTube', ...yt });
    } catch (e) {
      results.push({ platform: 'YouTube', error: e.message });
    }
  }

  if (twitch) {
    try {
      const twi = await getTwitchStats(twitch);
      results.push({ platform: 'Twitch', ...twi });
    } catch (e) {
      results.push({ platform: 'Twitch', error: e.message });
    }
  }

  return results;
}