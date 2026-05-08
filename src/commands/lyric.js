import { SlashCommandBuilder } from 'discord.js';
import { useMainPlayer, useQueue } from 'discord-player';
import { statusMessage } from '../lib/embeds.js';
import { trackMarkdown } from '../lib/format.js';
import { findLyricsForTrack, lyricsDisplayTitle, lyricsText, trimLyricsForDiscord } from '../lib/lyrics.js';
import { respond } from '../lib/replies.js';

export const data = new SlashCommandBuilder()
  .setName('lyric')
  .setDescription('Show lyrics for the current track');

export async function execute(interaction) {
  const queue = useQueue();
  const currentTrack = queue?.currentTrack;

  if (!queue || !currentTrack) {
    await respond(interaction, statusMessage('Nothing playing', 'Nothing is playing right now.', 'idle'));
    return;
  }

  await interaction.deferReply();

  try {
    const player = useMainPlayer();
    const result = await findLyricsForTrack(player.lyrics, currentTrack);
    const lyrics = lyricsText(result);

    if (!lyrics) {
      const message = result?.instrumental
        ? `${trackMarkdown(currentTrack)} appears to be instrumental, so no lyrics were returned.`
        : `No lyrics were found for ${trackMarkdown(currentTrack)}.`;

      await interaction.editReply(statusMessage('Lyrics not found', message, 'warning'));
      return;
    }

    await interaction.editReply(statusMessage('Lyrics', trimLyricsForDiscord(lyrics), 'info', {
      fields: [
        {
          name: 'Track',
          value: trimFieldValue(lyricsDisplayTitle(result, currentTrack))
        }
      ]
    }));
  } catch (error) {
    console.error('Lyric command failed:', error);
    await interaction.editReply(statusMessage(
      'Could not fetch lyrics',
      'Lyrics lookup failed. Check the bot logs for details.',
      'error'
    ));
  }
}

function trimFieldValue(value, limit = 1024) {
  const content = String(value ?? '').trim() || 'Unknown track';

  if (content.length <= limit) {
    return content;
  }

  return `${content.slice(0, limit - 3).trimEnd()}...`;
}
