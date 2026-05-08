import assert from 'node:assert/strict';
import { QueryType } from 'discord-player';
import { test } from 'node:test';
import { fallbackSearchEngineForQuery, normalizePlaybackQuery, searchEngineForQuery } from '../src/lib/query.js';

test('normalizes mobile and music YouTube URLs to regular YouTube URLs', () => {
  assert.equal(
    normalizePlaybackQuery('https://music.youtube.com/watch?v=abc123'),
    'https://www.youtube.com/watch?v=abc123'
  );
  assert.equal(
    normalizePlaybackQuery('https://m.youtube.com/watch?v=abc123'),
    'https://www.youtube.com/watch?v=abc123'
  );
});

test('routes Spotify URLs and URIs to the Spotify search engines', () => {
  assert.equal(searchEngineForQuery('spotify:track:abc123'), QueryType.SPOTIFY_SONG);
  assert.equal(searchEngineForQuery('https://open.spotify.com/album/abc123'), QueryType.SPOTIFY_ALBUM);
  assert.equal(searchEngineForQuery('https://open.spotify.com/intl-id/playlist/abc123'), QueryType.SPOTIFY_PLAYLIST);
});

test('uses YouTube as the default plain text search source', () => {
  assert.equal(searchEngineForQuery('lofi hip hop'), QueryType.YOUTUBE_SEARCH);
});

test('allows changing the default plain text search source', () => {
  assert.equal(searchEngineForQuery('lofi hip hop', 'spotify'), QueryType.SPOTIFY_SEARCH);
  assert.equal(searchEngineForQuery('lofi hip hop', 'youtube'), QueryType.YOUTUBE_SEARCH);
  assert.equal(searchEngineForQuery('lofi hip hop', 'auto'), undefined);
});

test('leaves non-Spotify URLs on automatic detection', () => {
  assert.equal(searchEngineForQuery('https://www.youtube.com/watch?v=abc123'), undefined);
  assert.equal(searchEngineForQuery('https://soundcloud.com/artist/song'), undefined);
});

test('falls back from Spotify plain text search to YouTube search', () => {
  assert.equal(fallbackSearchEngineForQuery('malu malu', 'spotify'), QueryType.YOUTUBE_SEARCH);
  assert.equal(fallbackSearchEngineForQuery('malu malu'), undefined);
  assert.equal(fallbackSearchEngineForQuery('malu malu', 'youtube'), undefined);
  assert.equal(fallbackSearchEngineForQuery('https://open.spotify.com/track/abc123'), undefined);
  assert.equal(fallbackSearchEngineForQuery('https://www.youtube.com/watch?v=abc123'), undefined);
});
