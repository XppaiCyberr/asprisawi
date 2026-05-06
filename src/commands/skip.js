import { SlashCommandBuilder } from 'discord.js';
import { useQueue } from 'discord-player';

export const data = new SlashCommandBuilder()
  .setName('skip')
  .setDescription('Skip the current track');

export async function execute(interaction) {
  const queue = useQueue();

  if (!queue || !queue.isPlaying()) {
    await interaction.reply('Nothing is playing right now.');
    return;
  }

  queue.node.skip();
  await interaction.reply('Skipped the current track.');
}
