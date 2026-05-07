import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

const guildSettingsUrl = pathToFileURL(path.resolve('src/lib/guild-settings.js')).href;

test('guild settings persist autoplay to a JSON file', async () => {
  const directory = path.join(tmpdir(), `asprisawi-settings-${Date.now()}`);
  const settingsFile = path.join(directory, 'guild-settings.json');
  const previousPath = process.env.GUILD_SETTINGS_PATH;

  process.env.GUILD_SETTINGS_PATH = settingsFile;

  try {
    const settings = await import(`${guildSettingsUrl}?write=${Date.now()}`);

    await settings.loadGuildSettings();
    assert.equal(settings.isAutoplayEnabled('guild-1'), false);
    assert.equal(settings.getDefaultSearchSource('guild-1'), 'spotify');
    assert.deepEqual(settings.getTtsSettings('guild-1'), {
      enabled: false,
      textChannelId: null,
      voice: null,
      voiceChannelId: null
    });
    assert.equal(await settings.setAutoplayEnabled('guild-1', true), true);
    assert.equal(await settings.setDefaultSearchSource('guild-1', 'youtube'), 'youtube');
    assert.deepEqual(await settings.setTtsSettings('guild-1', {
      enabled: true,
      textChannelId: '123456789012345678',
      voice: 'id-ID-ArdiNeural',
      voiceChannelId: '234567890123456789'
    }), {
      enabled: true,
      textChannelId: '123456789012345678',
      voice: 'id-ID-ArdiNeural',
      voiceChannelId: '234567890123456789'
    });

    const saved = JSON.parse(await readFile(settingsFile, 'utf8'));
    assert.deepEqual(saved, {
      'guild-1': {
        autoplay: true,
        defaultSearchSource: 'youtube',
        tts: {
          enabled: true,
          textChannelId: '123456789012345678',
          voice: 'id-ID-ArdiNeural',
          voiceChannelId: '234567890123456789'
        }
      }
    });

    const reloaded = await import(`${guildSettingsUrl}?read=${Date.now()}`);

    await reloaded.loadGuildSettings();
    assert.equal(reloaded.isAutoplayEnabled('guild-1'), true);
    assert.equal(reloaded.getDefaultSearchSource('guild-1'), 'youtube');
    assert.deepEqual(reloaded.getTtsSettings('guild-1'), {
      enabled: true,
      textChannelId: '123456789012345678',
      voice: 'id-ID-ArdiNeural',
      voiceChannelId: '234567890123456789'
    });
  } finally {
    if (previousPath === undefined) {
      delete process.env.GUILD_SETTINGS_PATH;
    } else {
      process.env.GUILD_SETTINGS_PATH = previousPath;
    }

    await rm(directory, { recursive: true, force: true });
  }
});

test('guild settings normalize invalid search source to Spotify', async () => {
  const directory = path.join(tmpdir(), `asprisawi-settings-${Date.now()}`);
  const settingsFile = path.join(directory, 'guild-settings.json');
  const previousPath = process.env.GUILD_SETTINGS_PATH;

  process.env.GUILD_SETTINGS_PATH = settingsFile;

  try {
    const settings = await import(`${guildSettingsUrl}?invalid=${Date.now()}`);

    await settings.loadGuildSettings();
    assert.equal(await settings.setDefaultSearchSource('guild-1', 'invalid'), 'spotify');
  } finally {
    if (previousPath === undefined) {
      delete process.env.GUILD_SETTINGS_PATH;
    } else {
      process.env.GUILD_SETTINGS_PATH = previousPath;
    }

    await rm(directory, { recursive: true, force: true });
  }
});

test('guild settings normalize invalid TTS channel IDs', async () => {
  const directory = path.join(tmpdir(), `asprisawi-settings-${Date.now()}`);
  const settingsFile = path.join(directory, 'guild-settings.json');
  const previousPath = process.env.GUILD_SETTINGS_PATH;

  process.env.GUILD_SETTINGS_PATH = settingsFile;

  try {
    const settings = await import(`${guildSettingsUrl}?tts-invalid=${Date.now()}`);

    await settings.loadGuildSettings();
    assert.deepEqual(await settings.setTtsSettings('guild-1', {
      enabled: true,
      textChannelId: 'not-a-channel',
      voiceChannelId: '123',
      voice: 'id-ID-ArdiNeural'
    }), {
      enabled: true,
      textChannelId: null,
      voice: 'id-ID-ArdiNeural',
      voiceChannelId: null
    });
  } finally {
    if (previousPath === undefined) {
      delete process.env.GUILD_SETTINGS_PATH;
    } else {
      process.env.GUILD_SETTINGS_PATH = previousPath;
    }

    await rm(directory, { recursive: true, force: true });
  }
});
