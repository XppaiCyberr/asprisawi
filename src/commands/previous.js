import { SlashCommandBuilder } from 'discord.js';
import { useHistory, useQueue } from 'discord-player';
import { statusMessage } from '../lib/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('previous')
  .setDescription('Play the previous track when history is available');

export async function execute(interaction) {
  const queue = useQueue();

  if (!queue) {
    await interaction.reply(statusMessage('No active session', 'This server does not have an active player session.', 'warning'));
    return;
  }

  const history = useHistory();

  if (!history) {
    await interaction.reply(statusMessage('No previous track', 'There is no previous track to play.', 'idle'));
    return;
  }

  try {
    await history.previous();
    await interaction.reply(statusMessage('Previous track', 'Playing the previous track.', 'skipped'));
  } catch (error) {
    console.error('Previous command failed:', error);
    await interaction.reply(statusMessage('No previous track', 'There is no previous track to play.', 'idle'));
  }
}
