import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QueryType } from 'discord-player';
import {
  filterYoutubeResponse,
  isLikelyShortTrack,
  shouldKeepYoutubeMusicTrack,
  SpotifyAwareYoutubeExtractor
} from '../src/lib/youtube-extractor.js';

test('does not claim local file queries', async () => {
  const extractor = new SpotifyAwareYoutubeExtractor({});

  assert.equal(await extractor.validate('C:\\Temp\\speech.mp3', QueryType.FILE), false);
});

test('filters short YouTube results from plain music searches', () => {
  assert.equal(isLikelyShortTrack(track({ duration: '0:31', title: 'Artist - Song #shorts' })), true);
  assert.equal(shouldKeepYoutubeMusicTrack(track({ duration: '0:31', title: 'Artist - Song #shorts' }), 'artist song'), false);
});

test('keeps normal music-looking YouTube results', () => {
  assert.equal(shouldKeepYoutubeMusicTrack(track({
    author: 'Artist',
    duration: '3:42',
    title: 'Artist - Song Official Audio'
  }), 'artist song'), true);
});

test('filters obvious non-music YouTube results', () => {
  assert.equal(shouldKeepYoutubeMusicTrack(track({
    author: 'Game Channel',
    duration: '12:00',
    title: 'Best Minecraft Gameplay Highlights'
  }), 'lofi hip hop'), false);
});

test('filters a YouTube response while preserving remaining track order', () => {
  const first = track({ duration: '0:45', title: 'Funny Short Clip' });
  const second = track({ duration: '4:01', title: 'Artist - Song Official Video' });
  const response = filterYoutubeResponse({
    playlist: null,
    tracks: [first, second]
  }, 'artist song');

  assert.deepEqual(response.tracks, [second]);
});

function track(overrides = {}) {
  return {
    author: overrides.author ?? 'Unknown',
    duration: overrides.duration ?? '3:00',
    title: overrides.title ?? 'Unknown',
    url: overrides.url ?? 'https://www.youtube.com/watch?v=abc123def45',
    ...overrides
  };
}
