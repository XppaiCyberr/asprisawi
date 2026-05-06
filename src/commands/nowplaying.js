import { SlashCommandBuilder } from 'discord.js';
import { useQueue } from 'discord-player';
import { trackMarkdown } from '../lib/format.js';

export const data = new SlashCommandBuilder()
  .setName('nowplaying')
  .setDescription('Show the current track');

export async function execute(interaction) {
  const queue = useQueue();
  const currentTrack = queue?.currentTrack;

  if (!queue || !currentTrack) {
    await interaction.reply('Nothing is playing right now.');
    return;
  }

  await interaction.reply(`Now playing: ${trackMarkdown(currentTrack)}`);
}
