import { SlashCommandBuilder } from 'discord.js';
import { QueueRepeatMode, useQueue } from 'discord-player';
import { setAutoplayEnabled } from '../lib/guild-settings.js';

const modeNames = {
  [QueueRepeatMode.OFF]: 'off',
  [QueueRepeatMode.TRACK]: 'track',
  [QueueRepeatMode.QUEUE]: 'queue',
  [QueueRepeatMode.AUTOPLAY]: 'autoplay'
};

export const data = new SlashCommandBuilder()
  .setName('loop')
  .setDescription('Change repeat mode')
  .addNumberOption((option) =>
    option
      .setName('mode')
      .setDescription('Repeat mode')
      .setRequired(true)
      .addChoices(
        { name: 'Off', value: QueueRepeatMode.OFF },
        { name: 'Track', value: QueueRepeatMode.TRACK },
        { name: 'Queue', value: QueueRepeatMode.QUEUE },
        { name: 'Autoplay', value: QueueRepeatMode.AUTOPLAY }
      )
  );

export async function execute(interaction) {
  const queue = useQueue();

  if (!queue) {
    await interaction.reply('This server does not have an active player session.');
    return;
  }

  const mode = interaction.options.getNumber('mode', true);
  queue.setRepeatMode(mode);
  setAutoplayEnabled(interaction.guildId, mode === QueueRepeatMode.AUTOPLAY);

  await interaction.reply(`Loop mode set to ${modeNames[mode] ?? mode}.`);
}
