import { SlashCommandBuilder } from 'discord.js';
import { useQueue } from 'discord-player';
import { statusMessage } from '../lib/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('stop')
  .setDescription('Stop playback and leave voice');

export async function execute(interaction) {
  const queue = useQueue();

  if (!queue) {
    await interaction.reply(statusMessage('No active session', 'This server does not have an active player session.', 'warning'));
    return;
  }

  queue.delete();
  await interaction.reply(statusMessage('Stopped', 'Stopped playback and left voice.', 'stopped'));
}
