import { SlashCommandBuilder } from 'discord.js';
import { useQueue } from 'discord-player';

export const data = new SlashCommandBuilder()
  .setName('pause')
  .setDescription('Toggle pause or resume');

export async function execute(interaction) {
  const queue = useQueue();

  if (!queue || !queue.isPlaying()) {
    await interaction.reply('Nothing is playing right now.');
    return;
  }

  const wasPaused = queue.node.isPaused();
  queue.node.setPaused(!wasPaused);

  await interaction.reply(wasPaused ? 'Resumed playback.' : 'Paused playback.');
}
