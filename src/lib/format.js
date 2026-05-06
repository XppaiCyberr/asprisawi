export function trackTitle(track) {
  return track?.title ?? track?.name ?? 'Unknown track';
}

export function trackSummary(track) {
  if (!track) {
    return 'Nothing is playing.';
  }

  const title = trackTitle(track);
  const author = track.author ? ` by ${track.author}` : '';
  const duration = track.duration ? ` (${track.duration})` : '';

  return `${title}${author}${duration}`;
}

export function trackMarkdown(track) {
  const title = escapeMarkdown(trackTitle(track));
  const author = track.author ? ` by ${escapeMarkdown(track.author)}` : '';
  const duration = track.duration ? ` \`${track.duration}\`` : '';

  if (track.url) {
    return `[${title}](${track.url})${author}${duration}`;
  }

  return `**${title}**${author}${duration}`;
}

export function trimMessage(content, limit = 1900) {
  if (content.length <= limit) {
    return content;
  }

  return `${content.slice(0, limit - 20)}\n...and more queued tracks.`;
}

function escapeMarkdown(value) {
  return String(value).replace(/([_*~`>|])/g, '\\$1');
}
