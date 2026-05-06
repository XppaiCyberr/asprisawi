import { QueryType } from 'discord-player';
import { YoutubeExtractor } from 'discord-player-youtube';

const SPOTIFY_QUERY_TYPES = new Set([
  QueryType.SPOTIFY_ALBUM,
  QueryType.SPOTIFY_PLAYLIST,
  QueryType.SPOTIFY_SONG,
  QueryType.SPOTIFY_SEARCH
]);

export class SpotifyAwareYoutubeExtractor extends YoutubeExtractor {
  async validate(query, type) {
    if (SPOTIFY_QUERY_TYPES.has(type) || isSpotifyUrl(query)) {
      return false;
    }

    return super.validate(query, type);
  }
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
