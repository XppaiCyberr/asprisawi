import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QueryType } from 'discord-player';
import { SpotifyAwareYoutubeExtractor } from '../src/lib/youtube-extractor.js';

test('does not claim local file queries', async () => {
  const extractor = new SpotifyAwareYoutubeExtractor({});

  assert.equal(await extractor.validate('C:\\Temp\\speech.mp3', QueryType.FILE), false);
});
