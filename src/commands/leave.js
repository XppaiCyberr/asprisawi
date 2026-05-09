import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { useMainPlayer } from 'discord-player';
import { statusMessage } from '../lib/embeds.js';
import { isLeaveAuthorized } from '../lib/player-controls.js';
import { respond } from '../lib/replies.js';

export const data = new SlashCommandBuilder()
  .setName('leave')
  .setDescription('Make the bot leave voice');

export async function execute(interaction) {
  if (!isLeaveAuthorized(interaction)) {
    await respond(interaction, {
      ...statusMessage('Permission denied', 'Only the bot owner, server managers, or authorized bot roles can make me leave voice.', 'error'),
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const player = useMainPlayer();
  const queue = player.nodes.get(interaction.guildId);

  if (queue) {
    player.nodes.delete(queue);
    await respond(interaction, statusMessage('Left voice', 'Stopped playback and left the voice channel.', 'stopped'));
    return;
  }

  const connection = player.voiceUtils.getConnection(interaction.guildId, interaction.client.user.id)
    ?? player.voiceUtils.getConnection(interaction.guildId);

  if (connection) {
    player.voiceUtils.disconnect(connection);
    await respond(interaction, statusMessage('Left voice', 'Disconnected from the voice channel.', 'stopped'));
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
