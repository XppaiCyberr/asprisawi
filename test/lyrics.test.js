import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  durationCodeToSeconds,
  lyricsSearchParamsForTrack,
  lyricsText,
  selectLyricsResult,
  stripSyncedLyrics,
  trimLyricsForDiscord
} from '../src/lib/lyrics.js';

test('builds cleaned LRCLIB search params from the current track', () => {
  assert.deepEqual(lyricsSearchParamsForTrack({
    title: 'Example Artist - Great Song (Official Music Video)',
    author: 'Example Artist - Topic'
  }), {
    q: 'Example Artist Great Song',
    trackName: 'Great Song',
    artistName: 'Example Artist'
  });
});

test('parses Discord Player duration strings', () => {
  assert.equal(durationCodeToSeconds('3:05'), 185);
  assert.equal(durationCodeToSeconds('1:02:03'), 3723);
  assert.equal(durationCodeToSeconds(''), null);
});

test('falls back to synced lyrics when plain lyrics are missing', () => {
  assert.equal(stripSyncedLyrics('[00:01.20]First line\n[00:03.00]Second line'), 'First line\nSecond line');
  assert.equal(lyricsText({
    plainLyrics: '',
    syncedLyrics: '[00:01.20]First line'
  }), 'First line');
});

test('prefers lyric results matching the current title and artist', () => {
  const track = {
    title: 'Example Artist - Great Song',
    author: 'Example Artist',
    duration: '3:00'
  };
  const wrong = {
    trackName: 'Other Song',
    artistName: 'Example Artist',
    duration: 180,
    plainLyrics: 'wrong'
  };
  const match = {
    trackName: 'Great Song',
    artistName: 'Example Artist',
    duration: 180,
    plainLyrics: 'right'
  };

  assert.equal(selectLyricsResult([wrong, match], track), match);
});

test('trims long lyrics for Discord embed descriptions', () => {
  const lyrics = trimLyricsForDiscord('a'.repeat(100), 40);

  assert.equal(lyrics.length <= 40, true);
  assert.match(lyrics, /\.\.\.lyrics truncated\.$/);
});
