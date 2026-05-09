import { SlashCommandBuilder } from 'discord.js';
import { useQueue } from 'discord-player';
import { statusMessage } from '../lib/embeds.js';
import { setAutoplayEnabled } from '../lib/guild-settings.js';
import { clearUpcomingTracks } from '../lib/player-controls.js';
import { respond } from '../lib/replies.js';
import { requireSameVoiceChannel } from '../lib/voice.js';

export const data = new SlashCommandBuilder()
  .setName('clear')
  .setDescription('Clear all upcoming songs and playlists from the queue');

export async function execute(interaction) {
  const queue = useQueue();

  if (!queue) {
    await respond(interaction, statusMessage('No active session', 'This server does not have an active player session.', 'warning'));
    return;
  }

  const voice = await requireSameVoiceChannel(interaction, queue);

  if (!voice.ok) {
    await respond(interaction, statusMessage('Voice required', voice.message, 'warning'));
    return;
  }

  const { clearedCount, repeatModeCleared } = clearUpcomingTracks(queue);

  if (repeatModeCleared) {
    await setAutoplayEnabled(interaction.guildId, false);
  }

  if (clearedCount === 0 && !repeatModeCleared) {
    await respond(interaction, statusMessage('Queue already clear', 'There are no upcoming tracks to clear.', 'idle'));
    return;
  }

  const details = [
    clearedCount === 1
      ? 'Cleared 1 upcoming track.'
      : `Cleared ${clearedCount} upcoming tracks.`,
    repeatModeCleared ? 'Loop/autoplay was turned off.' : null
  ].filter(Boolean).join('\n');

  await respond(interaction, statusMessage('Queue cleared', details, 'stopped'));
}
