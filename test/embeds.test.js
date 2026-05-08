import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addedTrackDetails } from '../src/lib/embeds.js';

test('addedTrackDetails summarizes queue position and estimated wait time', () => {
  const queuedBefore = track('Queued Before', '1:00');
  const addedTrack = track('Added Track', '2:20');
  const result = {
    track: addedTrack,
    queue: {
      currentTrack: track('Current Track', '2:30'),
      node: {
        getTimestamp: () => ({
          current: { value: 30_000 },
          total: { value: 150_000 }
        })
      },
      tracks: {
        toArray: () => [queuedBefore, addedTrack]
      }
    }
  };

  assert.deepEqual(addedTrackDetails(result), {
    estimatedUntilPlayed: '03:00',
    positionInQueue: '3',
    positionInUpcoming: '2',
    trackLength: '02:20'
  });
});

test('addedTrackDetails labels the next upcoming track', () => {
  const addedTrack = track('Added Track', '2:20');
  const result = {
    track: addedTrack,
    queue: {
      currentTrack: track('Current Track', '2:30'),
      node: {
        getTimestamp: () => ({
          current: { value: 0 },
          total: { value: 150_000 }
        })
      },
      tracks: {
        toArray: () => [addedTrack]
      }
    }
  };

  assert.equal(addedTrackDetails(result).positionInUpcoming, 'Next');
  assert.equal(addedTrackDetails(result).positionInQueue, '2');
});

function track(title, duration) {
  return {
    duration,
    durationMS: duration.split(':').reduce((total, part) => total * 60 + Number(part), 0) * 1000,
    title,
    url: `https://example.com/${encodeURIComponent(title)}`
  };
}
