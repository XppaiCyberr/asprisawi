import { SlashCommandBuilder } from 'discord.js';
import { useQueue } from 'discord-player';

export const data = new SlashCommandBuilder()
  .setName('shuffle')
  .setDescription('Shuffle upcoming tracks');

export async function execute(interaction) {
  const queue = useQueue();

  if (!queue || queue.tracks.size === 0) {
    await interaction.reply('There are no upcoming tracks to shuffle.');
    return;
  }

  queue.tracks.shuffle();
  await interaction.reply('Shuffled the upcoming tracks.');
}
