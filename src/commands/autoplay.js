import { SlashCommandBuilder } from 'discord.js';
import { QueueRepeatMode, useQueue } from 'discord-player';
import { statusMessage } from '../lib/embeds.js';
import { isAutoplayEnabled, setAutoplayEnabled } from '../lib/guild-settings.js';
import { respond } from '../lib/replies.js';
import { requireSameVoiceChannel } from '../lib/voice.js';

export const data = new SlashCommandBuilder()
  .setName('autoplay')
  .setDescription('Toggle related tracks when the queue ends')
  .addBooleanOption((option) =>
    option
      .setName('enabled')
      .setDescription('Turn autoplay on or off. Leave empty to toggle.')
  );

export async function execute(interaction) {
  const queue = useQueue();
  const requestedState = interaction.options.getBoolean('enabled');
  const currentState = queue
    ? queue.repeatMode === QueueRepeatMode.AUTOPLAY
    : isAutoplayEnabled(interaction.guildId);
  const enabled = requestedState ?? !currentState;

  if (queue) {
    const voice = await requireSameVoiceChannel(interaction, queue);

    if (!voice.ok) {
      await respond(interaction, statusMessage('Voice required', voice.message, 'warning'));
      return;
    }
  }

  await setAutoplayEnabled(interaction.guildId, enabled);

  if (queue && enabled) {
    queue.setRepeatMode(QueueRepeatMode.AUTOPLAY);
  } else if (queue?.repeatMode === QueueRepeatMode.AUTOPLAY) {
    queue.setRepeatMode(QueueRepeatMode.OFF);
  }

  const scope = queue ? 'this queue' : 'the next queue';
  await respond(interaction, statusMessage(
    'Autoplay',
    `Autoplay is now ${enabled ? 'enabled' : 'disabled'} for ${scope}.`,
    enabled ? 'success' : 'idle'
  ));
}
