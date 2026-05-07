import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseAutoplayTrack } from '../src/lib/autoplay.js';

test('autoplay skips the same song from a different video', async () => {
  const queue = createQueue({
    title: 'dia & INDAHKUS - MALU MALU (Official Music Video)',
    author: 'and 2 more',
    url: 'https://www.youtube.com/watch?v=official'
  });
  const selected = await chooseAutoplayTrack(queue, [
    {
      title: 'MALU MALU',
      author: 'dia',
      url: 'https://www.youtube.com/watch?v=other-upload'
    },
    {
      title: 'Rumah Singgah',
      author: 'Fabio Asher',
      url: 'https://www.youtube.com/watch?v=next'
    }
  ]);

  assert.equal(selected.title, 'Rumah Singgah');
});

function createQueue(currentTrack) {
  return {
    history: {
      currentTrack,
      tracks: {
        toArray: () => []
      }
    },
    tracks: {
      toArray: () => []
    },
    player: {
      search: async () => ({
        tracks: []
      })
    }
  };
}
