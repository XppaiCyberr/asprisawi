import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanAuthorName, cleanTrackTitle, normalizeComparableText, normalizedSongKeys } from '../src/lib/track-cleanup.js';

test('cleans common video noise from track metadata', () => {
  assert.equal(cleanAuthorName('Example Artist - Topic'), 'Example Artist');
  assert.equal(cleanTrackTitle({
    title: 'Example Artist - Great Song (Official Music Video)',
    author: 'Example Artist - Topic'
  }), 'Great Song');
});

test('normalizes comparable song text', () => {
  assert.equal(normalizeComparableText('Cafe del Mar | Official Lyrics 4K'), 'cafe del mar');
});

test('adds artist-prefixed title segment as a song key', () => {
  assert.deepEqual([...normalizedSongKeys({
    title: 'dia & INDAHKUS - MALU MALU (Official Music Video)',
    author: 'and 2 more'
  })], [
    'dia indahkus malu malu',
    'malu malu'
  ]);
});
