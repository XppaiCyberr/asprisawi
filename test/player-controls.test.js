import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QueueRepeatMode } from 'discord-player';
import { stopQueuePlayback } from '../src/lib/player-controls.js';

test('stopQueuePlayback stops audio without destroying the voice dispatcher', () => {
  const stopCalls = [];
  const repeatModes = [];
  const queue = {
    options: {
      leaveOnStop: true
    },
    node: {
      stop: (force) => {
        stopCalls.push(force);
        return true;
      }
    },
    setRepeatMode: (mode) => {
      repeatModes.push(mode);
    }
  };

  assert.equal(stopQueuePlayback(queue), true);
  assert.equal(queue.options.leaveOnStop, false);
  assert.deepEqual(repeatModes, [QueueRepeatMode.OFF]);
  assert.deepEqual(stopCalls, [false]);
});
