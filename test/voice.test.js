import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requireSameVoiceChannel } from '../src/lib/voice.js';

test('allows playback control from the active voice channel', async () => {
  const activeChannel = createVoiceChannel('music');
  const result = await requireSameVoiceChannel(
    createInteraction(activeChannel, activeChannel),
    { channel: activeChannel }
  );

  assert.equal(result.ok, true);
  assert.equal(result.voiceChannel, activeChannel);
});

test('rejects playback control from another voice channel', async () => {
  const activeChannel = createVoiceChannel('music');
  const userChannel = createVoiceChannel('lobby');
  const result = await requireSameVoiceChannel(
    createInteraction(userChannel, activeChannel),
    { channel: activeChannel }
  );

  assert.equal(result.ok, false);
  assert.match(result.message, /Join <#music> to control playback\./);
});

test('requires the user to be in voice before controlling playback', async () => {
  const activeChannel = createVoiceChannel('music');
  const result = await requireSameVoiceChannel(
    createInteraction(null, activeChannel),
    { channel: activeChannel }
  );

  assert.equal(result.ok, false);
  assert.equal(result.message, 'Join a voice channel first.');
});

function createInteraction(userVoiceChannel, botVoiceChannel) {
  const botMember = {
    voice: {
      channel: botVoiceChannel
    }
  };

  return {
    user: {
      id: 'user-1'
    },
    guild: {
      members: {
        me: botMember,
        fetch: async () => ({
          voice: {
            channel: userVoiceChannel
          }
        }),
        fetchMe: async () => botMember
      }
    }
  };
}

function createVoiceChannel(id) {
  return {
    id,
    toString() {
      return `<#${id}>`;
    }
  };
}
