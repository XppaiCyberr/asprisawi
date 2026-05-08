import { trackTitle } from './format.js';
import { cleanAuthorName, cleanTrackTitle, normalizeComparableText, plainText } from './track-cleanup.js';

export const MAX_LYRICS_LENGTH = 3800;

export async function findLyricsForTrack(lyricsClient, track) {
  const results = await lyricsClient.search(lyricsSearchParamsForTrack(track));

  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }

  return selectLyricsResult(results, track);
}

export function lyricsSearchParamsForTrack(track) {
  const title = cleanTrackTitle(track) || trackTitle(track);
  const artist = cleanAuthorName(track?.author);

  return {
    q: plainText([artist, title].filter(Boolean).join(' ')),
    trackName: title,
    ...(artist ? { artistName: artist } : {})
  };
}

export function selectLyricsResult(results, track) {
  return [...results]
    .sort((left, right) => lyricsResultScore(right, track) - lyricsResultScore(left, track))
    .at(0) ?? null;
}

export function lyricsText(result) {
  const plainLyrics = String(result?.plainLyrics ?? '').trim();

  if (plainLyrics) {
    return plainLyrics;
  }

  return stripSyncedLyrics(result?.syncedLyrics);
}

export function stripSyncedLyrics(syncedLyrics) {
  return String(syncedLyrics ?? '')
    .split('\n')
    .map((line) => line.replace(/^\s*(?:\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]\s*)+/, '').trim())
    .filter(Boolean)
    .join('\n');
}

export function trimLyricsForDiscord(lyrics, limit = MAX_LYRICS_LENGTH) {
  const content = String(lyrics ?? '').trim();

  if (content.length <= limit) {
    return content;
  }

  return `${content.slice(0, limit - 22).trimEnd()}\n\n...lyrics truncated.`;
}

export function lyricsDisplayTitle(result, track) {
  const title = plainText(result?.trackName ?? result?.name ?? cleanTrackTitle(track) ?? trackTitle(track));
  const artist = plainText(result?.artistName ?? cleanAuthorName(track?.author));

  return artist ? `${title} by ${artist}` : title;
}

export function durationCodeToSeconds(duration) {
  if (typeof duration === 'number' && Number.isFinite(duration)) {
    return Math.max(0, Math.round(duration));
  }

  const value = String(duration ?? '').trim();

  if (!value) {
    return null;
  }

  const parts = value
    .split(':')
    .map((part) => Number(part));

  if (parts.length === 0 || parts.some((part) => !Number.isFinite(part) || part < 0)) {
    return null;
  }

  return parts.reduce((total, part) => total * 60 + part, 0);
}

function lyricsResultScore(result, track) {
  const targetTitle = normalizeComparableText(cleanTrackTitle(track));
  const targetArtist = normalizeComparableText(cleanAuthorName(track?.author));
  const targetDuration = durationCodeToSeconds(track?.duration);
  const resultTitle = normalizeComparableText(result?.trackName ?? result?.name ?? '');
  const resultArtist = normalizeComparableText(result?.artistName ?? '');
  const resultDuration = durationCodeToSeconds(result?.duration);
  let score = 0;

  if (lyricsText(result)) {
    score += 20;
  }

  if (targetTitle && resultTitle === targetTitle) {
    score += 80;
  } else if (targetTitle && resultTitle.includes(targetTitle)) {
    score += 40;
  }

  if (targetArtist && resultArtist === targetArtist) {
    score += 40;
  } else if (targetArtist && resultArtist.includes(targetArtist)) {
    score += 20;
  }

  if (targetDuration !== null && resultDuration !== null && Math.abs(targetDuration - resultDuration) <= 2) {
    score += 10;
  }

  if (result?.instrumental) {
    score -= 25;
  }

  return score;
}
