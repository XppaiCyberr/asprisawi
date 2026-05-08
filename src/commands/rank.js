import { SlashCommandBuilder } from 'discord.js';
import { statusMessage } from '../lib/embeds.js';
import { respond } from '../lib/replies.js';
import { formatVoiceDuration, getVoiceRank } from '../lib/voice-rank.js';

export const data = new SlashCommandBuilder()
  .setName('rank')
  .setDescription('Show voice call time rankings')
  .addIntegerOption((option) =>
    option
      .setName('limit')
      .setDescription('Number of users to show')
      .setMinValue(1)
      .setMaxValue(25)
  );

export async function execute(interaction) {
  const limit = interaction.options.getInteger('limit') ?? 10;
  const rank = await getVoiceRank(interaction.guildId, { limit });

  if (!rank.length) {
    await respond(interaction, statusMessage(
      'Voice rank',
      'No voice time has been tracked yet. Join a voice channel and leave it once to start saving totals.',
      'idle'
    ));
    return;
  }

  await respond(interaction, {
    ...statusMessage(
      'Voice rank',
      rank
        .map((entry, index) => rankLine(entry, index))
        .join('\n'),
      'info',
      {
        footer: 'Current voice sessions are included in the displayed totals.'
      }
    ),
    allowedMentions: {
      parse: []
    }
  });
}

function rankLine(entry, index) {
  const active = entry.active
    ? ` - in voice now (+${formatVoiceDuration(entry.activeMs)})`
    : '';

  return `**${index + 1}.** <@${entry.userId}> - ${formatVoiceDuration(entry.durationMs)}${active}`;
}
