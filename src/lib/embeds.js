import { EmbedBuilder } from 'discord.js';
import { trackMarkdown } from './format.js';
import { musicPlayerControls } from './music-components.js';

export const STATUS_COLORS = {
  playing: 0x22c55e,
  queued: 0xf59e0b,
  skipped: 0x3b82f6,
  stopped: 0xef4444,
  error: 0xef4444,
  success: 0x22c55e,
  warning: 0xf59e0b,
  info: 0x5865f2,
  idle: 0x94a3b8,
  neutral: 0x64748b
};

const STATUS_TITLE_EMOJIS = {
  Autoplay: '🔁',
  'Command failed': '⚠️',
  'Could not play': '❌',
  'Could not fetch lyrics': '\u26a0\ufe0f',
  Lyrics: '\uD83C\uDFB6',
  'Lyrics not found': '\uD83D\uDD0D',
  'Loop mode': '🔂',
  'No active session': '📭',
  'No previous track': '⏮️',
  'Nothing playing': '🔇',
  'Nothing to shuffle': '🔀',
  'Now playing': '🎵',
  Paused: '⏸️',
  'Playback failed': '❌',
  'Permission denied': '🚫',
  'Previous track': '⏮️',
  Queue: '📜',
  'Queue empty': '📭',
  'Queue finished': '✅',
  Queued: '➕',
  'Queued playlist': '📚',
  Resumed: '▶️',
  Shuffled: '🔀',
  Skipped: '⏭️',
  Stopped: '⏹️',
  'Trying YouTube': '🔎',
  'Unknown command': '❔',
  'Voice channel empty': '👋',
  'Voice required': '🎙️',
  Volume: '🔊'
};

export function statusMessage(title, description, color = 'neutral', options = {}) {
  const embed = new EmbedBuilder()
    .setColor(resolveColor(color))
    .setTitle(statusTitle(title, options.emoji))
    .setDescription(trimEmbedDescription(description))
    .setTimestamp();

  if (options.footer) {
    embed.setFooter({ text: options.footer });
  }

  if (options.fields?.length) {
    embed.addFields(options.fields);
  }

  return {
    embeds: [embed],
    ...(options.controls ? { components: musicPlayerControls() } : {}),
    ...(options.flags === undefined ? {} : { flags: options.flags })
  };
}

export function trackStatusMessage(title, track, color = 'neutral', options = {}) {
  return statusMessage(title, trackMarkdown(track), color, options);
}

export function addedTrackMessage(result, requester) {
  const details = addedTrackDetails(result);
  const embed = new EmbedBuilder()
    .setColor(resolveColor('queued'))
    .setTitle('Added Track')
    .addFields(
      {
        name: 'Track',
        value: trackMarkdown(result.track),
        inline: false
      },
      {
        name: 'Estimated time until played',
        value: details.estimatedUntilPlayed,
        inline: true
      },
      {
        name: 'Track Length',
        value: details.trackLength,
        inline: true
      },
      {
        name: 'Position in upcoming',
        value: details.positionInUpcoming,
        inline: true
      },
      {
        name: 'Position in queue',
        value: details.positionInQueue,
        inline: true
      }
    )
    .setTimestamp();

  if (requester) {
    embed.setFooter({
      text: `Requested by ${requester.globalName ?? requester.username ?? requester.id}`,
      iconURL: requester.displayAvatarURL?.()
    });
  }

  return {
    embeds: [embed],
    components: musicPlayerControls()
  };
}

export function addedTrackDetails(result) {
  const queue = result.queue;
  const upcomingTracks = queue?.tracks?.toArray?.() ?? [];
  const trackIndex = upcomingTracks.findIndex((track) => isSameTrack(track, result.track));
  const upcomingIndex = trackIndex >= 0
    ? trackIndex
    : Math.max(0, upcomingTracks.length - 1);
  const hasCurrentTrack = Boolean(queue?.currentTrack);
  const positionInUpcoming = upcomingIndex === 0 ? 'Next' : String(upcomingIndex + 1);
  const positionInQueue = String(upcomingIndex + (hasCurrentTrack ? 2 : 1));

  return {
    estimatedUntilPlayed: formatDuration(estimatedTimeUntilTrackMs(queue, upcomingIndex)),
    positionInQueue,
    positionInUpcoming,
    trackLength: trackLength(result.track)
  };
}

function isSameTrack(left, right) {
  return left === right
    || (left?.id && left.id === right?.id)
    || (left?.url && left.url === right?.url && left?.title === right?.title);
}

function statusTitle(title, emoji) {
  if (emoji === false) {
    return title;
  }

  const prefix = emoji || STATUS_TITLE_EMOJIS[title];

  if (!prefix || title.startsWith(`${prefix} `)) {
    return title;
  }

  return `${prefix} ${title}`;
}

function resolveColor(color) {
  return typeof color === 'number'
    ? color
    : STATUS_COLORS[color] ?? STATUS_COLORS.neutral;
}

function trimEmbedDescription(description, limit = 4000) {
  const content = String(description);

  if (content.length <= limit) {
    return content;
  }

  return `${content.slice(0, limit - 20)}\n...and more.`;
}

function estimatedTimeUntilTrackMs(queue, upcomingIndex) {
  if (!queue?.currentTrack) {
    return 0;
  }

  const timestamp = queue.node?.getTimestamp?.();
  const currentRemaining = Number.isFinite(timestamp?.total?.value) && Number.isFinite(timestamp?.current?.value)
    ? Math.max(0, timestamp.total.value - timestamp.current.value)
    : trackDurationMs(queue.currentTrack);
  const tracksBefore = queue.tracks
    ?.toArray?.()
    ?.slice(0, upcomingIndex)
    ?.reduce((total, track) => total + trackDurationMs(track), 0) ?? 0;

  return currentRemaining + tracksBefore;
}

function trackLength(track) {
  const durationMs = trackDurationMs(track);

  if (durationMs > 0) {
    return formatDuration(durationMs);
  }

  return track?.duration || 'Unknown';
}

function trackDurationMs(track) {
  if (Number.isFinite(track?.durationMS) && track.durationMS > 0) {
    return track.durationMS;
  }

  const parts = String(track?.duration ?? '')
    .split(':')
    .map((part) => Number.parseInt(part, 10));

  if (!parts.length || parts.some((part) => !Number.isFinite(part))) {
    return 0;
  }

  return parts.reduce((total, part) => total * 60 + part, 0) * 1000;
}

function formatDuration(durationMs) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds % 3600 / 60);
  const seconds = totalSeconds % 60;
  const segments = hours > 0
    ? [hours, minutes, seconds]
    : [minutes, seconds];

  return segments
    .map((segment) => String(segment).padStart(2, '0'))
    .join(':');
}
