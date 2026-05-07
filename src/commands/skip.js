import { SlashCommandBuilder } from 'discord.js';
import { useQueue } from 'discord-player';
import { statusMessage } from '../lib/embeds.js';
import { respond } from '../lib/replies.js';
import { requireSameVoiceChannel } from '../lib/voice.js';

export const data = new SlashCommandBuilder()
  .setName('skip')
  .setDescription('Skip the current track');

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

  queue.node.skip();
  await respond(interaction, statusMessage('Skipped', 'Skipped the current track.', 'skipped'));
}
