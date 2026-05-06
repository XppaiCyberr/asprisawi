import { SlashCommandBuilder } from 'discord.js';
import { useQueue } from 'discord-player';
import { statusMessage, trackStatusMessage } from '../lib/embeds.js';
import { respond } from '../lib/replies.js';

export const data = new SlashCommandBuilder()
  .setName('nowplaying')
  .setDescription('Show the current track');

export async function execute(interaction) {
  const queue = useQueue();
  const currentTrack = queue?.currentTrack;

  if (!queue || !currentTrack) {
    await respond(interaction, statusMessage('Nothing playing', 'Nothing is playing right now.', 'idle'));
    return;
  }

  await respond(interaction, trackStatusMessage('Now playing', currentTrack, 'playing'));
}
