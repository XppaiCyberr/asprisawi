import { SlashCommandBuilder } from 'discord.js';
import { useQueue } from 'discord-player';
import { trackMarkdown } from '../lib/format.js';
import { respond } from '../lib/replies.js';

export const data = new SlashCommandBuilder()
  .setName('nowplaying')
  .setDescription('Show the current track');

export async function execute(interaction) {
  const queue = useQueue();
  const currentTrack = queue?.currentTrack;

  if (!queue || !currentTrack) {
    await respond(interaction, 'Nothing is playing right now.');
    return;
  }

  await respond(interaction, `Now playing: ${trackMarkdown(currentTrack)}`);
}
