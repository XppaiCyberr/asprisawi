import { SlashCommandBuilder } from 'discord.js';
import { useQueue } from 'discord-player';

export const data = new SlashCommandBuilder()
  .setName('volume')
  .setDescription('Set playback volume')
  .addIntegerOption((option) =>
    option
      .setName('level')
      .setDescription('Volume from 0 to 100')
      .setMinValue(0)
      .setMaxValue(100)
      .setRequired(true)
  );

export async function execute(interaction) {
  const queue = useQueue();

  if (!queue) {
    await interaction.reply('This server does not have an active player session.');
    return;
  }

  const volume = interaction.options.getInteger('level', true);
  queue.node.setVolume(volume);

  await interaction.reply(`Volume set to ${volume}.`);
}
