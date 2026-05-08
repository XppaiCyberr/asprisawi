import { SlashCommandBuilder } from 'discord.js';
import { QueueRepeatMode, useMainPlayer } from 'discord-player';
import { statusMessage } from '../lib/embeds.js';
import { trackMarkdown } from '../lib/format.js';
import { getDefaultSearchSource, isAutoplayEnabled } from '../lib/guild-settings.js';
import { createPlaybackStatus } from '../lib/playback-status.js';
import { fallbackSearchEngineForQuery, normalizePlaybackQuery, searchEngineForQuery } from '../lib/query.js';
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
  const defaultSearchSource = getDefaultSearchSource(interaction.guildId);
  const primarySearchEngine = searchEngineForQuery(query, defaultSearchSource);
  const fallbackSearchEngine = fallbackSearchEngineForQuery(query, defaultSearchSource);

  await interaction.deferReply();
  const playbackStatus = createPlaybackStatus(interaction);

  try {
    const result = await playWithFallback({
      fallbackSearchEngine,
      interaction,
      playbackStatus,
      player,
      primarySearchEngine,
      query,
      voiceChannel: voice.voiceChannel
    });

    await finishPlayResult(result, interaction, playbackStatus);
  } catch (error) {
    console.error('Play command failed:', error);
    await playbackStatus.update(statusMessage(
      'Could not play',
      'Could not play that request. Try a YouTube or Spotify URL/search, direct audio URL, SoundCloud, Vimeo, or Reverbnation source.',
      'error'
    ), 'error');
  }
}

async function playWithFallback(options) {
  try {
    return await playWithSearchEngine(options, options.primarySearchEngine);
  } catch (error) {
    if (!isNoResultError(error) || !options.fallbackSearchEngine) {
      throw error;
    }

    console.warn(`No Spotify results for "${options.query}". Falling back to YouTube search.`);
    await options.playbackStatus.update(statusMessage(
      'Trying YouTube',
      'Spotify returned no results for that search. Trying YouTube instead.',
      'warning'
    ), 'pending');

    return playWithSearchEngine(options, options.fallbackSearchEngine);
  }
}

async function playWithSearchEngine(options, searchEngine) {
  return options.player.play(options.voiceChannel, options.query, {
    requestedBy: options.interaction.user,
    searchEngine,
    afterSearch: (searchResult) => {
      setTrackPlaybackStatus(searchResult.tracks?.[0], options.playbackStatus);
      return searchResult;
    },
    nodeOptions: {
      metadata: {
        textChannel: options.interaction.channel,
        requestedBy: options.interaction.user
      },
      bufferingTimeout: 15000,
      leaveOnStop: false,
      leaveOnEnd: false,
      leaveOnEmpty: false,
      skipOnNoStream: true,
      repeatMode: isAutoplayEnabled(options.interaction.guildId)
        ? QueueRepeatMode.AUTOPLAY
        : QueueRepeatMode.OFF,
      volume: 75
    }
  });
}

async function finishPlayResult(result, interaction, playbackStatus) {
  setQueueMetadata(result.queue, {
    textChannel: interaction.channel,
    requestedBy: interaction.user
  });
  setTrackPlaybackStatus(result.track, playbackStatus);

  if (playbackStatus.state !== 'playing') {
    await playbackStatus.update(playResultMessage(result), 'queued');
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

function isNoResultError(error) {
  return error?.code === 'ERR_NO_RESULT';
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
      'queued',
      { controls: true }
    );
  }

  return statusMessage('Queued', trackMarkdown(result.track), 'queued', {
    controls: true
  });
}
