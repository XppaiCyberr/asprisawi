import { SlashCommandBuilder } from 'discord.js';
import { useQueue } from 'discord-player';
import { statusMessage } from '../lib/embeds.js';
import { trackSummary } from '../lib/format.js';
import { getDefaultSearchSource, getTtsSettings, isAutoplayEnabled } from '../lib/guild-settings.js';
import { respond } from '../lib/replies.js';
import { DEFAULT_TTS_VOICE, isAutomaticTtsConfigured } from '../lib/tts.js';

const searchSourceNames = {
  auto: 'Automatic',
  spotify: 'Spotify',
  youtube: 'YouTube'
};

export const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('Show bot setup and playback health');

export async function execute(interaction) {
  const queue = useQueue();
  const tts = getTtsSettings(interaction.guildId);
  const upcomingCount = queue?.tracks?.toArray?.().length ?? 0;
  const currentTrack = queue?.currentTrack;

  await respond(interaction, statusMessage(
    'Bot status',
    `Online for ${formatUptime(process.uptime() * 1000)}.`,
    'info',
    {
      fields: [
        {
          name: 'Setup',
          value: lines([
            ['Discord user', interaction.client?.user?.tag ?? 'connected'],
            ['Message Content Intent', enabledText(isAutomaticTtsConfigured())],
            ['YouTube cookie', configuredText(process.env.YOUTUBE_COOKIE)],
            ['Groq API key', configuredText(process.env.GROQ_API_KEY)],
            ['FFmpeg path', process.env.FFMPEG_PATH ? 'configured' : 'bundled/default']
          ])
        },
        {
          name: 'Server settings',
          value: lines([
            ['Search source', searchSourceNames[getDefaultSearchSource(interaction.guildId)]],
            ['Autoplay', enabledText(isAutoplayEnabled(interaction.guildId))],
            ['TTS', enabledText(tts.enabled)],
            ['TTS voice', tts.voice ?? process.env.TTS_VOICE ?? DEFAULT_TTS_VOICE]
          ])
        },
        {
          name: 'Playback',
          value: lines([
            ['State', playbackState(queue)],
            ['Current', trimFieldValue(trackSummary(currentTrack), 300)],
            ['Upcoming', String(upcomingCount)],
            ['Voice channel', queue?.channel ? String(queue.channel) : 'not connected']
          ])
        }
      ]
    }
  ));
}

function playbackState(queue) {
  if (!queue) {
    return 'no active session';
  }

  if (queue.node?.isPaused?.()) {
    return 'paused';
  }

  return queue.isPlaying?.() ? 'playing' : 'idle';
}

function configuredText(value) {
  return String(value ?? '').trim() ? 'configured' : 'missing';
}

function enabledText(value) {
  return value ? 'enabled' : 'disabled';
}

function lines(items) {
  return items
    .map(([label, value]) => `**${label}:** ${value || 'unknown'}`)
    .join('\n');
}

function formatUptime(durationMs) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor(totalSeconds % 86400 / 3600);
  const minutes = Math.floor(totalSeconds % 3600 / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function trimFieldValue(value, limit = 1024) {
  const text = String(value ?? '').trim();

  if (text.length <= limit) {
    return text || 'unknown';
  }

  return `${text.slice(0, limit - 3).trimEnd()}...`;
}
