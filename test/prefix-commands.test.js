import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MessageFlags } from 'discord.js';
import { QueueRepeatMode } from 'discord-player';
import { createPrefixInteraction, parsePrefixCommand } from '../src/lib/prefix-commands.js';

test('parsePrefixCommand reads command names and keeps spaced arguments', () => {
  assert.deepEqual(parsePrefixCommand('?play The Beatles - Help!'), {
    args: 'The Beatles - Help!',
    commandName: 'play',
    prefix: '?'
  });
});

test('createPrefixInteraction maps text arguments to slash-style options', () => {
  assert.equal(
    createInteraction('?play The Beatles - Help!').options.getString('query', true),
    'The Beatles - Help!'
  );
  assert.equal(createInteraction('?volume 65').options.getInteger('level', true), 65);
  assert.equal(createInteraction('?loop autoplay').options.getNumber('mode', true), QueueRepeatMode.AUTOPLAY);
  assert.equal(createInteraction('?autoplay off').options.getBoolean('enabled'), false);
  assert.equal(createInteraction('?tts on id-ID-GadisNeural').options.getBoolean('enabled'), true);
  assert.equal(createInteraction('?tts on id-ID-GadisNeural').options.getString('voice'), 'id-ID-GadisNeural');
});

test('createPrefixInteraction rejects missing required arguments', () => {
  assert.throws(() => createInteraction('?play').options.getString('query', true), /query is required/);
  assert.throws(() => createInteraction('?volume loud'), /level must be a number from 0 to 100/);
});

test('createPrefixInteraction strips slash-only ephemeral flags from message replies', async () => {
  const replies = [];
  const interaction = createInteraction('?leave', replies);

  await interaction.reply({
    content: 'Only the bot owner can make me leave voice.',
    flags: MessageFlags.Ephemeral
  });

  assert.deepEqual(replies, [
    {
      content: 'Only the bot owner can make me leave voice.'
    }
  ]);
});

function createInteraction(content, replies = []) {
  const parsed = parsePrefixCommand(content);

  return createPrefixInteraction({
    author: { id: 'user-1', username: 'user' },
    channel: {},
    channelId: 'text-1',
    content,
    guild: { id: 'guild-1' },
    guildId: 'guild-1',
    member: {},
    reply: async (payload) => {
      replies.push(payload);
      return { edit: async () => {} };
    }
  }, parsed);
}
