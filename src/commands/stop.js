import { SlashCommandBuilder } from 'discord.js';
import { useQueue } from 'discord-player';
import { statusMessage } from '../lib/embeds.js';
import { stopQueuePlayback } from '../lib/player-controls.js';
import { respond } from '../lib/replies.js';
import { requireSameVoiceChannel } from '../lib/voice.js';

export const data = new SlashCommandBuilder()
  .setName('stop')
  .setDescription('Stop playback without leaving voice');

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

  stopQueuePlayback(queue);
  await respond(interaction, statusMessage('Stopped', 'Stopped playback. I will stay in the voice channel.', 'stopped'));
}
