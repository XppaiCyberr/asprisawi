import { SlashCommandBuilder } from 'discord.js';
import { useQueue } from 'discord-player';
import { statusMessage } from '../lib/embeds.js';
import { respond } from '../lib/replies.js';
import { requireSameVoiceChannel } from '../lib/voice.js';

export const data = new SlashCommandBuilder()
  .setName('pause')
  .setDescription('Toggle pause or resume');

export async function execute(interaction) {
  const queue = useQueue();

  if (!queue || !queue.isPlaying()) {
    await respond(interaction, statusMessage('Nothing playing', 'Nothing is playing right now.', 'idle'));
    return;
  }

  const voice = await requireSameVoiceChannel(interaction, queue);

  if (!voice.ok) {
    await respond(interaction, statusMessage('Voice required', voice.message, 'warning'));
    return;
  }

  const wasPaused = queue.node.isPaused();
  queue.node.setPaused(!wasPaused);

  await respond(interaction, statusMessage(
    wasPaused ? 'Resumed' : 'Paused',
    wasPaused ? 'Resumed playback.' : 'Paused playback.',
    wasPaused ? 'success' : 'warning'
  ));
}
