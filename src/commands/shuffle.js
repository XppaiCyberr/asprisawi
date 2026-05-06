import { SlashCommandBuilder } from 'discord.js';
import { useQueue } from 'discord-player';
import { statusMessage } from '../lib/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('shuffle')
  .setDescription('Shuffle upcoming tracks');

export async function execute(interaction) {
  const queue = useQueue();

  if (!queue || queue.tracks.size === 0) {
    await interaction.reply(statusMessage('Nothing to shuffle', 'There are no upcoming tracks to shuffle.', 'idle'));
    return;
  }

  queue.tracks.shuffle();
  await interaction.reply(statusMessage('Shuffled', 'Shuffled the upcoming tracks.', 'skipped'));
}
