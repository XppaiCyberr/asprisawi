import { SlashCommandBuilder } from 'discord.js';
import { useQueue } from 'discord-player';
import { statusMessage } from '../lib/embeds.js';
import { respond } from '../lib/replies.js';
import { requireSameVoiceChannel } from '../lib/voice.js';

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
    await respond(interaction, statusMessage('No active session', 'This server does not have an active player session.', 'warning'));
    return;
  }

  const voice = await requireSameVoiceChannel(interaction, queue);

  if (!voice.ok) {
    await respond(interaction, statusMessage('Voice required', voice.message, 'warning'));
    return;
  }

  const volume = interaction.options.getInteger('level', true);
  queue.node.setVolume(volume);

  await respond(interaction, statusMessage('Volume', `Volume set to ${volume}.`, 'info'));
}
