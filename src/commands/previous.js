import { SlashCommandBuilder } from 'discord.js';
import { useHistory, useQueue } from 'discord-player';

export const data = new SlashCommandBuilder()
  .setName('previous')
  .setDescription('Play the previous track when history is available');

export async function execute(interaction) {
  const queue = useQueue();

  if (!queue) {
    await interaction.reply('This server does not have an active player session.');
    return;
  }

  const history = useHistory();

  if (!history) {
    await interaction.reply('There is no previous track to play.');
    return;
  }

  try {
    await history.previous();
    await interaction.reply('Playing the previous track.');
  } catch (error) {
    console.error('Previous command failed:', error);
    await interaction.reply('There is no previous track to play.');
  }
}
