import { QueryType } from 'discord-player';

export function normalizePlaybackQuery(query) {
  return normalizeYouTubeUrl(query);
}

export function searchEngineForQuery(query) {
  const spotifyType = spotifyQueryType(query);

  if (spotifyType === 'track') {
    return QueryType.SPOTIFY_SONG;
  }

  if (spotifyType === 'album') {
    return QueryType.SPOTIFY_ALBUM;
  }

  if (spotifyType === 'playlist') {
    return QueryType.SPOTIFY_PLAYLIST;
  }

  return undefined;
}

function spotifyQueryType(query) {
  const value = String(query).trim();
  const uriMatch = /^spotify:(track|album|playlist):[A-Za-z0-9]+/i.exec(value);

  if (uriMatch) {
    return uriMatch[1].toLowerCase();
  }

  try {
    const url = new URL(value);

    if (url.hostname !== 'open.spotify.com') {
      return null;
    }

    const parts = url.pathname.split('/').filter(Boolean);
    const type = parts[0]?.startsWith('intl-') ? parts[1] : parts[0];

    if (['track', 'album', 'playlist'].includes(type)) {
      return type;
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeYouTubeUrl(query) {
  try {
    const url = new URL(query);
    const hostname = url.hostname.toLowerCase();

    if (hostname === 'music.youtube.com' || hostname === 'm.youtube.com') {
      url.hostname = 'www.youtube.com';
      return url.toString();
    }
  } catch {
    return query;
  }

  return query;
}
