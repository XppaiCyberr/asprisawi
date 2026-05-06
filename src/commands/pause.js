import { SlashCommandBuilder } from 'discord.js';
import { useQueue } from 'discord-player';
import { statusMessage } from '../lib/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('pause')
  .setDescription('Toggle pause or resume');

export async function execute(interaction) {
  const queue = useQueue();

  if (!queue || !queue.isPlaying()) {
    await interaction.reply(statusMessage('Nothing playing', 'Nothing is playing right now.', 'idle'));
    return;
  }

  const wasPaused = queue.node.isPaused();
  queue.node.setPaused(!wasPaused);

  await interaction.reply(statusMessage(
    wasPaused ? 'Resumed' : 'Paused',
    wasPaused ? 'Resumed playback.' : 'Paused playback.',
    wasPaused ? 'success' : 'warning'
  ));
}
