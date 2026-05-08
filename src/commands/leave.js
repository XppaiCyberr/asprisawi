import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { useQueue } from 'discord-player';
import { statusMessage } from '../lib/embeds.js';
import { LEAVE_USER_ID } from '../lib/player-controls.js';
import { respond } from '../lib/replies.js';

export const data = new SlashCommandBuilder()
  .setName('leave')
  .setDescription('Make the bot leave voice');

export async function execute(interaction) {
  if (interaction.user.id !== LEAVE_USER_ID) {
    await respond(interaction, {
      ...statusMessage('Permission denied', 'Only the bot owner can make me leave voice.', 'error'),
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const queue = useQueue();

  if (queue) {
    queue.delete();
    await respond(interaction, statusMessage('Left voice', 'Stopped playback and left the voice channel.', 'stopped'));
    return;
  }

  const botMember = interaction.guild.members.me
    ?? await interaction.guild.members.fetchMe();

  if (!botMember.voice.channel) {
    await respond(interaction, statusMessage('No active session', 'This server does not have an active player session.', 'warning'));
    return;
  }

  await botMember.voice.disconnect('Leave command requested by owner.');
  await respond(interaction, statusMessage('Left voice', 'Stopped playback and left the voice channel.', 'stopped'));
}
