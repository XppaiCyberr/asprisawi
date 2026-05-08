import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  activeVoiceSessionCount,
  applyVoiceStateUpdate,
  formatVoiceDuration,
  voiceRank
} from '../src/lib/voice-rank.js';

test('tracks active voice time in rank results', () => {
  const guildId = 'voice-rank-active';

  assert.equal(applyVoiceStateUpdate(
    state({ guildId }),
    state({ channelId: 'voice-1', guildId }),
    1_000
  ), false);

  const rank = voiceRank(guildId, { now: 61_000 });

  assert.equal(activeVoiceSessionCount(guildId), 1);
  assert.equal(rank.length, 1);
  assert.equal(rank[0].active, true);
  assert.equal(rank[0].durationMs, 60_000);
  assert.equal(rank[0].channelId, 'voice-1');
});

test('keeps voice time continuous when a user moves channels', () => {
  const guildId = 'voice-rank-move';

  applyVoiceStateUpdate(
    state({ guildId }),
    state({ channelId: 'voice-1', guildId }),
    1_000
  );
  applyVoiceStateUpdate(
    state({ channelId: 'voice-1', guildId }),
    state({ channelId: 'voice-2', guildId }),
    31_000
  );

  const [entry] = voiceRank(guildId, { now: 61_000 });

  assert.equal(entry.durationMs, 60_000);
  assert.equal(entry.channelId, 'voice-2');
});

test('adds completed voice sessions to total time', () => {
  const guildId = 'voice-rank-total';

  applyVoiceStateUpdate(
    state({ guildId }),
    state({ channelId: 'voice-1', guildId }),
    1_000
  );

  assert.equal(applyVoiceStateUpdate(
    state({ channelId: 'voice-1', guildId }),
    state({ guildId }),
    91_000
  ), true);

  const [entry] = voiceRank(guildId, { now: 121_000 });

  assert.equal(entry.active, false);
  assert.equal(entry.totalMs, 90_000);
  assert.equal(entry.durationMs, 90_000);
});

test('ignores bot voice states', () => {
  const guildId = 'voice-rank-bot';

  applyVoiceStateUpdate(
    state({ bot: true, guildId }),
    state({ bot: true, channelId: 'voice-1', guildId }),
    1_000
  );

  assert.deepEqual(voiceRank(guildId, { now: 61_000 }), []);
});

test('formats voice durations compactly', () => {
  assert.equal(formatVoiceDuration(45_000), '45s');
  assert.equal(formatVoiceDuration(65_000), '1m 5s');
  assert.equal(formatVoiceDuration(3_900_000), '1h 5m');
  assert.equal(formatVoiceDuration(90_000_000), '1d 1h 0m');
});

function state(options = {}) {
  const guildId = options.guildId ?? 'voice-rank-guild';
  const userId = options.userId ?? 'user-1';
  const displayName = options.displayName ?? 'Voice User';

  return {
    channelId: options.channelId ?? null,
    guild: {
      id: guildId
    },
    id: userId,
    member: {
      displayName,
      id: userId,
      user: {
        bot: Boolean(options.bot),
        id: userId,
        username: displayName
      }
    }
  };
}
