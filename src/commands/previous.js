import { SlashCommandBuilder } from 'discord.js';
import { useHistory, useQueue } from 'discord-player';
import { statusMessage } from '../lib/embeds.js';
import { respond } from '../lib/replies.js';
import { requireSameVoiceChannel } from '../lib/voice.js';

export const data = new SlashCommandBuilder()
  .setName('previous')
  .setDescription('Play the previous track when history is available');

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

  const history = useHistory();

  if (!history) {
    await respond(interaction, statusMessage('No previous track', 'There is no previous track to play.', 'idle'));
    return;
  }

  try {
    await history.previous();
    await respond(interaction, statusMessage('Previous track', 'Playing the previous track.', 'skipped'));
  } catch (error) {
    console.error('Previous command failed:', error);
    await respond(interaction, statusMessage('No previous track', 'There is no previous track to play.', 'idle'));
  }
}
