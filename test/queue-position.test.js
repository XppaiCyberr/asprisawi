import assert from 'node:assert/strict';
import { test } from 'node:test';
import { moveAddedSingleTrackNext } from '../src/lib/queue-position.js';

test('moves a newly added single track ahead of playlist leftovers', () => {
  const playlistTrack = { title: 'Playlist Track' };
  const addedTrack = { title: 'Added Track' };
  const moves = [];
  const result = {
    queue: {
      node: {
        move: (from, to) => moves.push({ from, to })
      },
      tracks: {
        toArray: () => [playlistTrack, addedTrack]
      }
    },
    searchResult: {
      playlist: null
    },
    track: addedTrack
  };

  assert.equal(moveAddedSingleTrackNext(result, true), true);
  assert.deepEqual(moves, [{ from: 1, to: 0 }]);
});

test('does not reorder playlists or inactive queues', () => {
  const addedTrack = { title: 'Added Track' };
  const moves = [];
  const result = {
    queue: {
      node: {
        move: (from, to) => moves.push({ from, to })
      },
      tracks: {
        toArray: () => [addedTrack]
      }
    },
    searchResult: {
      playlist: { title: 'Playlist' }
    },
    track: addedTrack
  };

  assert.equal(moveAddedSingleTrackNext(result, true), false);
  assert.equal(moveAddedSingleTrackNext({ ...result, searchResult: { playlist: null } }, false), false);
  assert.deepEqual(moves, []);
});
