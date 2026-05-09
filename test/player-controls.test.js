import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PermissionFlagsBits } from 'discord.js';
import { QueueRepeatMode } from 'discord-player';
import { clearUpcomingTracks, isLeaveAuthorized, stopQueuePlayback } from '../src/lib/player-controls.js';

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

test('clearUpcomingTracks clears queue and disables repeat mode', () => {
  const repeatModes = [];
  const tracks = {
    size: 3,
    clearCalled: false,
    clear() {
      this.clearCalled = true;
    }
  };
  const queue = {
    repeatMode: QueueRepeatMode.AUTOPLAY,
    tracks,
    setRepeatMode: (mode) => repeatModes.push(mode)
  };

  assert.deepEqual(clearUpcomingTracks(queue), {
    clearedCount: 3,
    repeatModeCleared: true
  });
  assert.equal(tracks.clearCalled, true);
  assert.deepEqual(repeatModes, [QueueRepeatMode.OFF]);
});

test('clearUpcomingTracks leaves repeat mode alone when already off', () => {
  const repeatModes = [];
  const queue = {
    repeatMode: QueueRepeatMode.OFF,
    tracks: {
      size: 0,
      clear() {}
    },
    setRepeatMode: (mode) => repeatModes.push(mode)
  };

  assert.deepEqual(clearUpcomingTracks(queue), {
    clearedCount: 0,
    repeatModeCleared: false
  });
  assert.deepEqual(repeatModes, []);
});

test('isLeaveAuthorized allows owner, server manager, and configured role', () => {
  const previousOwnerIds = process.env.BOT_OWNER_IDS;
  const previousAuthorizedRoleIds = process.env.AUTHORIZED_ROLE_IDS;

  process.env.BOT_OWNER_IDS = 'owner-1';
  process.env.AUTHORIZED_ROLE_IDS = 'role-1';

  try {
    assert.equal(isLeaveAuthorized(interaction({ userId: 'owner-1' })), true);
    assert.equal(isLeaveAuthorized(interaction({ manageGuild: true, userId: 'user-1' })), true);
    assert.equal(isLeaveAuthorized(interaction({ roles: ['role-1'], userId: 'user-2' })), true);
    assert.equal(isLeaveAuthorized(interaction({ roles: ['role-2'], userId: 'user-3' })), false);
  } finally {
    restoreEnv('BOT_OWNER_IDS', previousOwnerIds);
    restoreEnv('AUTHORIZED_ROLE_IDS', previousAuthorizedRoleIds);
  }
});

function interaction({ manageGuild = false, roles = [], userId }) {
  return {
    member: {
      roles
    },
    memberPermissions: {
      has: (permission) => permission === PermissionFlagsBits.ManageGuild && manageGuild
    },
    user: {
      id: userId
    }
  };
}

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
