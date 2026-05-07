import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createSawiChatRequest,
  DEFAULT_SAWI_MODEL,
  MAX_SAWI_QUESTION_LENGTH,
  normalizeSawiContext,
  normalizeSawiQuestion,
  SAWI_SYSTEM_PROMPT
} from '../src/lib/sawi-ai.js';

test('normalizes Sawi questions and rejects invalid input', () => {
  assert.equal(normalizeSawiQuestion(' hello \n sawi '), 'hello sawi');
  assert.throws(() => normalizeSawiQuestion('   '), /cannot be empty/);
  assert.throws(() => normalizeSawiQuestion('a'.repeat(MAX_SAWI_QUESTION_LENGTH + 1)), /characters or less/);
});

test('builds a Groq chat request with the Sawi system prompt', () => {
  const request = createSawiChatRequest('hi sawi');

  assert.equal(request.model, DEFAULT_SAWI_MODEL);
  assert.equal(request.messages[0].role, 'system');
  assert.equal(request.messages[0].content, SAWI_SYSTEM_PROMPT);
  assert.deepEqual(request.messages[1], {
    role: 'user',
    content: 'hi sawi'
  });
  assert.equal(request.max_completion_tokens, 500);
  assert.equal(request.temperature, 0.8);
});

test('allows overriding the Groq model and generation options', () => {
  const request = createSawiChatRequest('music?', {
    maxCompletionTokens: 100,
    model: 'custom-model',
    temperature: 0.2
  });

  assert.equal(request.model, 'custom-model');
  assert.equal(request.max_completion_tokens, 100);
  assert.equal(request.temperature, 0.2);
});

test('can include previous Sawi message context for replies', () => {
  const request = createSawiChatRequest('what do you mean?', {
    previousAssistantMessage: ' Sawi said \n hydrate '
  });

  assert.deepEqual(request.messages.map((message) => message.role), ['system', 'assistant', 'user']);
  assert.equal(request.messages[1].content, 'Sawi said hydrate');
  assert.equal(request.messages[2].content, 'what do you mean?');
});

test('trims long Sawi context', () => {
  assert.equal(normalizeSawiContext('a'.repeat(2500)).length, 2000);
});
