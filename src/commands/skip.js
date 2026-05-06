import { SlashCommandBuilder } from 'discord.js';
import { useQueue } from 'discord-player';
import { statusMessage } from '../lib/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('skip')
  .setDescription('Skip the current track');

export async function execute(interaction) {
  const queue = useQueue();

  if (!queue || !queue.isPlaying()) {
    await interaction.reply(statusMessage('Nothing playing', 'Nothing is playing right now.', 'idle'));
    return;
  }

  queue.node.skip();
  await interaction.reply(statusMessage('Skipped', 'Skipped the current track.', 'skipped'));
}
