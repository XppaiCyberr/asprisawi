import { QueryType } from 'discord-player';
import { YoutubeExtractor } from 'discord-player-youtube';

const SHORT_DURATION_MS = 75_000;
const SPOTIFY_QUERY_TYPES = new Set([
  QueryType.FILE,
  QueryType.SPOTIFY_ALBUM,
  QueryType.SPOTIFY_PLAYLIST,
  QueryType.SPOTIFY_SONG,
  QueryType.SPOTIFY_SEARCH
]);
const NON_MUSIC_PATTERNS = [
  /\b#?shorts?\b/i,
  /\bclips?\b/i,
  /\btik\s*tok\b/i,
  /\bmemes?\b/i,
  /\bfunny\b/i,
  /\bcomedy\b/i,
  /\btrailers?\b/i,
  /\bteasers?\b/i,
  /\bmovie\b/i,
  /\bscene\b/i,
  /\bepisodes?\b/i,
  /\bpodcasts?\b/i,
  /\binterviews?\b/i,
  /\breactions?\b/i,
  /\breviews?\b/i,
  /\btutorials?\b/i,
  /\bhow to\b/i,
  /\bnews\b/i,
  /\bvlogs?\b/i,
  /\bchallenges?\b/i,
  /\bpranks?\b/i,
  /\bgameplay\b/i,
  /\bhighlights?\b/i,
  /\bunboxing\b/i,
  /\bspeedruns?\b/i
];
const MUSIC_PATTERNS = [
  /\bofficial\s+(music\s+)?video\b/i,
  /\bofficial\s+audio\b/i,
  /\blyrics?\b/i,
  /\blyric\s+video\b/i,
  /\baudio\b/i,
  /\bsongs?\b/i,
  /\bmusic\s+video\b/i,
  /\bvisuali[sz]er\b/i,
  /\bremix\b/i,
  /\bcover\b/i,
  /\binstrumental\b/i,
  /\bkaraoke\b/i,
  /\bfeat\.?\b/i,
  /\bft\.?\b/i,
  /\bmv\b/i,
  /\bprovided\s+to\s+youtube\s+by\b/i
];
const SHORT_QUERY_PATTERN = /\b(short|clip|intro|jingle)\b/i;

export class SpotifyAwareYoutubeExtractor extends YoutubeExtractor {
  async validate(query, type) {
    if (SPOTIFY_QUERY_TYPES.has(type) || isSpotifyUrl(query)) {
      return false;
    }

    return super.validate(query, type);
  }

  async handle(query, context) {
    const response = await super.handle(query, context);

    return isUrl(query)
      ? response
      : filterYoutubeResponse(response, query);
  }

  async getRelatedTracks(track, history) {
    const response = await super.getRelatedTracks(track, history);

    return filterYoutubeResponse(response, `${track?.author ?? ''} ${track?.title ?? ''}`);
  }
}

export function filterYoutubeResponse(response, query = '') {
  if (!response?.tracks?.length) {
    return response;
  }

  const tracks = response.tracks.filter((track) => shouldKeepYoutubeMusicTrack(track, query));

  if (response.playlist) {
    response.playlist.tracks = response.playlist.tracks?.filter((track) => tracks.includes(track)) ?? tracks;
  }

  return {
    ...response,
    tracks
  };
}

export function shouldKeepYoutubeMusicTrack(track, query = '') {
  const haystack = youtubeTrackText(track);
  const queryText = String(query ?? '');

  if (isLikelyShortTrack(track) && !SHORT_QUERY_PATTERN.test(queryText)) {
    return false;
  }

  if (MUSIC_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return true;
  }

  return !NON_MUSIC_PATTERNS.some((pattern) => pattern.test(haystack));
}

export function isLikelyShortTrack(track) {
  const url = String(track?.url ?? track?.raw?.url ?? '');
  const durationMs = youtubeTrackDurationMs(track);

  return url.includes('/shorts/')
    || Boolean(track?.raw?.is_shorts || track?.raw?.isShorts)
    || (durationMs > 0 && durationMs < SHORT_DURATION_MS);
}

function isSpotifyUrl(query) {
  if (typeof query !== 'string') {
    return false;
  }

  if (query.startsWith('spotify:')) {
    return true;
  }

  try {
    return new URL(query).hostname === 'open.spotify.com';
  } catch {
    return false;
  }
}

function youtubeTrackText(track) {
  return [
    track?.title,
    track?.author,
    track?.url,
    track?.raw?.title?.text,
    track?.raw?.author?.name,
    track?.metadata?.source?.title?.text,
    track?.metadata?.source?.author?.name
  ]
    .filter(Boolean)
    .join(' ');
}

function youtubeTrackDurationMs(track) {
  if (Number.isFinite(track?.raw?.durationMS)) {
    return track.raw.durationMS;
  }

  const rawSeconds = Number(
    track?.raw?.duration?.seconds
      ?? track?.metadata?.source?.duration?.seconds
      ?? track?.raw?.basicInfo?.basic_info?.duration
  );

  if (Number.isFinite(rawSeconds) && rawSeconds > 0) {
    return rawSeconds * 1000;
  }

  return durationCodeToMs(track?.duration);
}

function durationCodeToMs(value) {
  const parts = String(value ?? '')
    .split(':')
    .map((part) => Number.parseInt(part, 10));

  if (parts.length === 0 || parts.some((part) => !Number.isFinite(part))) {
    return 0;
  }

  return parts.reduce((total, part) => total * 60 + part, 0) * 1000;
}

function isUrl(query) {
  try {
    new URL(String(query));
    return true;
  } catch {
    return false;
  }
}
