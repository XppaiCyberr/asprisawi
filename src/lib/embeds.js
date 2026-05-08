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
