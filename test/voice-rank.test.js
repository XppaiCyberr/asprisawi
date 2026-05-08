import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  activeVoiceSessionCount,
  applyVoiceStateUpdate,
  DEFAULT_TRACKED_VOICE_CHANNEL_IDS,
  formatVoiceDuration,
  voiceRank
} from '../src/lib/voice-rank.js';

const TRACKED_CHANNEL_ID = DEFAULT_TRACKED_VOICE_CHANNEL_IDS[0];

test('tracks active voice time in rank results', () => {
  const guildId = 'voice-rank-active';

  assert.equal(applyVoiceStateUpdate(
    state({ guildId }),
    state({ channelId: TRACKED_CHANNEL_ID, guildId }),
    1_000
  ), false);

  const rank = voiceRank(guildId, { now: 61_000 });

  assert.equal(activeVoiceSessionCount(guildId), 1);
  assert.equal(rank.length, 1);
  assert.equal(rank[0].active, true);
  assert.equal(rank[0].durationMs, 60_000);
  assert.equal(rank[0].channelId, TRACKED_CHANNEL_ID);
});

test('ignores untracked voice channels', () => {
  const guildId = 'voice-rank-untracked';

  applyVoiceStateUpdate(
    state({ guildId }),
    state({ channelId: 'other-voice', guildId }),
    1_000
  );

  assert.equal(activeVoiceSessionCount(guildId), 0);
  assert.deepEqual(voiceRank(guildId, { now: 61_000 }), []);
});

test('stops tracking when a user leaves the tracked channel', () => {
  const guildId = 'voice-rank-move';

  applyVoiceStateUpdate(
    state({ guildId }),
    state({ channelId: TRACKED_CHANNEL_ID, guildId }),
    1_000
  );
  assert.equal(applyVoiceStateUpdate(
    state({ channelId: TRACKED_CHANNEL_ID, guildId }),
    state({ channelId: 'other-voice', guildId }),
    31_000
  ), true);

  const [entry] = voiceRank(guildId, { now: 61_000 });

  assert.equal(entry.active, false);
  assert.equal(entry.durationMs, 30_000);
  assert.equal(entry.channelId, null);
});

test('adds completed voice sessions to total time', () => {
  const guildId = 'voice-rank-total';

  applyVoiceStateUpdate(
    state({ guildId }),
    state({ channelId: TRACKED_CHANNEL_ID, guildId }),
    1_000
  );

  assert.equal(applyVoiceStateUpdate(
    state({ channelId: TRACKED_CHANNEL_ID, guildId }),
    state({ guildId }),
    91_000
  ), true);

  const [entry] = voiceRank(guildId, { now: 121_000 });

  assert.equal(entry.active, false);
  assert.equal(entry.totalMs, 90_000);
  assert.equal(entry.durationMs, 90_000);
});

test('accumulates time across separate voice sessions', () => {
  const guildId = 'voice-rank-accumulate';

  applyVoiceStateUpdate(
    state({ guildId }),
    state({ channelId: TRACKED_CHANNEL_ID, guildId }),
    0
  );
  applyVoiceStateUpdate(
    state({ channelId: TRACKED_CHANNEL_ID, guildId }),
    state({ guildId }),
    2 * 60 * 60 * 1000
  );
  applyVoiceStateUpdate(
    state({ guildId }),
    state({ channelId: TRACKED_CHANNEL_ID, guildId }),
    3 * 60 * 60 * 1000
  );
  applyVoiceStateUpdate(
    state({ channelId: TRACKED_CHANNEL_ID, guildId }),
    state({ guildId }),
    9 * 60 * 60 * 1000
  );

  const [entry] = voiceRank(guildId, { now: 10 * 60 * 60 * 1000 });

  assert.equal(entry.totalMs, 8 * 60 * 60 * 1000);
  assert.equal(entry.durationMs, 8 * 60 * 60 * 1000);
});

test('ignores bot voice states', () => {
  const guildId = 'voice-rank-bot';

  applyVoiceStateUpdate(
    state({ bot: true, guildId }),
    state({ bot: true, channelId: TRACKED_CHANNEL_ID, guildId }),
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
