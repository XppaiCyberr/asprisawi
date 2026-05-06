import { SlashCommandBuilder } from 'discord.js';
import { useQueue } from 'discord-player';

export const data = new SlashCommandBuilder()
  .setName('stop')
  .setDescription('Stop playback and leave voice');

export async function execute(interaction) {
  const queue = useQueue();

  if (!queue) {
    await interaction.reply('This server does not have an active player session.');
    return;
  }

  queue.delete();
  await interaction.reply('Stopped playback and left voice.');
}
