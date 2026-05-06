import { EmbedBuilder } from 'discord.js';
import { trackMarkdown } from './format.js';

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

export function statusMessage(title, description, color = 'neutral', options = {}) {
  const embed = new EmbedBuilder()
    .setColor(resolveColor(color))
    .setTitle(title)
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
    ...(options.flags === undefined ? {} : { flags: options.flags })
  };
}

export function trackStatusMessage(title, track, color = 'neutral', options = {}) {
  return statusMessage(title, trackMarkdown(track), color, options);
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
