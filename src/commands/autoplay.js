import { SlashCommandBuilder } from 'discord.js';
import { QueueRepeatMode, useQueue } from 'discord-player';
import { isAutoplayEnabled, setAutoplayEnabled } from '../lib/guild-settings.js';

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

  setAutoplayEnabled(interaction.guildId, enabled);

  if (queue && enabled) {
    queue.setRepeatMode(QueueRepeatMode.AUTOPLAY);
  } else if (queue?.repeatMode === QueueRepeatMode.AUTOPLAY) {
    queue.setRepeatMode(QueueRepeatMode.OFF);
  }

  const scope = queue ? 'this queue' : 'the next queue';
  await interaction.reply(`Autoplay is now ${enabled ? 'enabled' : 'disabled'} for ${scope}.`);
}
