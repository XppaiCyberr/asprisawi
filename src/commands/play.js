import { SlashCommandBuilder } from 'discord.js';
import { QueueRepeatMode, useMainPlayer } from 'discord-player';
import { statusMessage } from '../lib/embeds.js';
import { trackMarkdown } from '../lib/format.js';
import { isAutoplayEnabled } from '../lib/guild-settings.js';
import { createPlaybackStatus } from '../lib/playback-status.js';
import { normalizePlaybackQuery, searchEngineForQuery } from '../lib/query.js';
import { respond } from '../lib/replies.js';
import { requirePlayableVoiceChannel } from '../lib/voice.js';

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Play a track or add it to the queue')
  .addStringOption((option) =>
    option
      .setName('query')
      .setDescription('Song name, URL, playlist, or stream URL')
      .setRequired(true)
  );

export async function execute(interaction) {
  const voice = await requirePlayableVoiceChannel(interaction);

  if (!voice.ok) {
    await respond(interaction, statusMessage('Voice required', voice.message, 'warning'));
    return;
  }

  const query = normalizePlaybackQuery(interaction.options.getString('query', true));
  const player = useMainPlayer();

  await interaction.deferReply();
  const playbackStatus = createPlaybackStatus(interaction);

  try {
    const result = await player.play(voice.voiceChannel, query, {
      requestedBy: interaction.user,
      searchEngine: searchEngineForQuery(query),
      afterSearch: (searchResult) => {
        setTrackPlaybackStatus(searchResult.tracks?.[0], playbackStatus);
        return searchResult;
      },
      nodeOptions: {
        metadata: {
          textChannel: interaction.channel,
          requestedBy: interaction.user
        },
        bufferingTimeout: 15000,
        leaveOnStop: false,
        leaveOnEnd: false,
        leaveOnEmpty: false,
        skipOnNoStream: true,
        repeatMode: isAutoplayEnabled(interaction.guildId)
          ? QueueRepeatMode.AUTOPLAY
          : QueueRepeatMode.OFF,
        volume: 75
      }
    });

    setQueueMetadata(result.queue, {
      textChannel: interaction.channel,
      requestedBy: interaction.user
    });
    setTrackPlaybackStatus(result.track, playbackStatus);

    if (playbackStatus.state !== 'playing') {
      await playbackStatus.update(playResultMessage(result), 'queued');
    }
  } catch (error) {
    console.error('Play command failed:', error);
    await playbackStatus.update(statusMessage(
      'Could not play',
      'Could not play that request. Try a YouTube or Spotify URL/search, direct audio URL, SoundCloud, Vimeo, or Reverbnation source.',
      'error'
    ), 'error');
  }
}

function setQueueMetadata(queue, metadata) {
  const current = queue.metadata?.send
    ? { textChannel: queue.metadata }
    : { ...(queue.metadata ?? {}) };

  queue.setMetadata({
    ...current,
    ...metadata
  });
}

function setTrackPlaybackStatus(track, playbackStatus) {
  if (!track) {
    return;
  }

  const metadata = track.metadata && typeof track.metadata === 'object'
    ? track.metadata
    : {};

  track.setMetadata({
    ...metadata,
    playbackStatus
  });
}

function playResultMessage(result) {
  const playlist = result.searchResult?.playlist;
  const trackCount = result.searchResult?.tracks?.length ?? 1;

  if (playlist && trackCount > 1) {
    return statusMessage(
      'Queued playlist',
      `Queued ${trackCount} tracks from **${playlist.title}**.\nFirst: ${trackMarkdown(result.track)}`,
      'queued'
    );
  }

  return statusMessage('Queued', trackMarkdown(result.track), 'queued');
}
