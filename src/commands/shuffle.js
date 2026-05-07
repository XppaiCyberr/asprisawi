import { SlashCommandBuilder } from 'discord.js';
import { useQueue } from 'discord-player';
import { statusMessage } from '../lib/embeds.js';
import { respond } from '../lib/replies.js';
import { requireSameVoiceChannel } from '../lib/voice.js';

export const data = new SlashCommandBuilder()
  .setName('shuffle')
  .setDescription('Shuffle upcoming tracks');

export async function execute(interaction) {
  const queue = useQueue();

  if (!queue || queue.tracks.size === 0) {
    await respond(interaction, statusMessage('Nothing to shuffle', 'There are no upcoming tracks to shuffle.', 'idle'));
    return;
  }

  const voice = await requireSameVoiceChannel(interaction, queue);

  if (!voice.ok) {
    await respond(interaction, statusMessage('Voice required', voice.message, 'warning'));
    return;
  }

  queue.tracks.shuffle();
  await respond(interaction, statusMessage('Shuffled', 'Shuffled the upcoming tracks.', 'skipped'));
}
