import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_TTS_VOICE,
  escapeSsmlText,
  isAutomaticTtsConfigured,
  MAX_TTS_TEXT_LENGTH,
  normalizeTtsText,
  normalizeTtsVoice,
  ttsTrackTitle
} from '../src/lib/tts.js';

test('escapes text before it is placed inside SSML', () => {
  assert.equal(
    escapeSsmlText('Tom & "Jerry" <voice>\'s test'),
    'Tom &amp; &quot;Jerry&quot; &lt;voice&gt;&apos;s test'
  );
});

test('normalizes TTS text and rejects empty or oversized input', () => {
  assert.equal(normalizeTtsText(' hello \n world '), 'hello world');
  assert.throws(() => normalizeTtsText('   '), /cannot be empty/);
  assert.throws(() => normalizeTtsText('a'.repeat(MAX_TTS_TEXT_LENGTH + 1)), /characters or less/);
});

test('uses a default voice and rejects unsafe voice names', () => {
  const previousVoice = process.env.TTS_VOICE;

  try {
    delete process.env.TTS_VOICE;
    assert.equal(normalizeTtsVoice(), DEFAULT_TTS_VOICE);
    assert.equal(normalizeTtsVoice('en-US-AriaNeural'), 'en-US-AriaNeural');
    assert.throws(() => normalizeTtsVoice('en-US-AriaNeural"><break time="5s"/>'), /ShortName/);
  } finally {
    if (previousVoice === undefined) {
      delete process.env.TTS_VOICE;
    } else {
      process.env.TTS_VOICE = previousVoice;
    }
  }
});

test('builds a compact TTS track title', () => {
  assert.equal(ttsTrackTitle('hello world'), 'TTS: hello world');
  assert.equal(ttsTrackTitle('a'.repeat(90), 20), 'TTS: aaaaaaaaaaaaaaaaa...');
});

test('requires explicit opt-in before requesting Message Content intent', () => {
  const previousValue = process.env.ENABLE_MESSAGE_CONTENT_INTENT;

  try {
    delete process.env.ENABLE_MESSAGE_CONTENT_INTENT;
    assert.equal(isAutomaticTtsConfigured(), false);

    process.env.ENABLE_MESSAGE_CONTENT_INTENT = 'false';
    assert.equal(isAutomaticTtsConfigured(), false);

    process.env.ENABLE_MESSAGE_CONTENT_INTENT = 'true';
    assert.equal(isAutomaticTtsConfigured(), true);
  } finally {
    if (previousValue === undefined) {
      delete process.env.ENABLE_MESSAGE_CONTENT_INTENT;
    } else {
      process.env.ENABLE_MESSAGE_CONTENT_INTENT = previousValue;
    }
  }
});
