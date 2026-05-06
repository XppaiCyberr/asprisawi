import { SlashCommandBuilder } from 'discord.js';
import { useQueue } from 'discord-player';
import { statusMessage } from '../lib/embeds.js';
import { trackMarkdown, trimMessage } from '../lib/format.js';
import { respond } from '../lib/replies.js';

export const data = new SlashCommandBuilder()
  .setName('queue')
  .setDescription('Show the current queue');

export async function execute(interaction) {
  const queue = useQueue();
  const currentTrack = queue?.currentTrack;

  if (!queue || !currentTrack) {
    await respond(interaction, statusMessage('Queue empty', 'The queue is empty.', 'idle'));
    return;
  }

  const upcomingTracks = queue.tracks.toArray().slice(0, 10);
  const lines = [
    `Now playing: ${trackMarkdown(currentTrack)}`,
    ''
  ];

  if (upcomingTracks.length === 0) {
    lines.push('No upcoming tracks.');
  } else {
    lines.push('Upcoming:');
    lines.push(...upcomingTracks.map((track, index) => `${index + 1}. ${trackMarkdown(track)}`));
  }

  await respond(interaction, statusMessage('Queue', trimMessage(lines.join('\n')), 'info'));
}
