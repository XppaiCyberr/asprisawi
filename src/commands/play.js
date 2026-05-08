import { ActionRowBuilder, ComponentType, MessageFlags, SlashCommandBuilder, StringSelectMenuBuilder } from 'discord.js';
import { QueueRepeatMode, useMainPlayer } from 'discord-player';
import { addedTrackMessage, statusMessage } from '../lib/embeds.js';
import { trackMarkdown } from '../lib/format.js';
import { getDefaultSearchSource, isAutoplayEnabled } from '../lib/guild-settings.js';
import { createPlaybackStatus } from '../lib/playback-status.js';
import { fallbackSearchEngineForQuery, isPlainPlaybackSearch, normalizePlaybackQuery, searchEngineForQuery } from '../lib/query.js';
import { respond } from '../lib/replies.js';
import { cleanAuthorName, cleanTrackTitle, plainText } from '../lib/track-cleanup.js';
import { requirePlayableVoiceChannel } from '../lib/voice.js';

const SEARCH_SELECTION_LIMIT = 5;
const SEARCH_SELECTION_TIMEOUT_MS = 45000;
const SEARCH_SELECTION_PREFIX = 'play-search';

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
    const playOptions = {
      fallbackSearchEngine,
      interaction,
      playbackStatus,
      player,
      primarySearchEngine,
      query,
      voiceChannel: voice.voiceChannel
    };
    const result = isPlainPlaybackSearch(query)
      ? await selectAndPlayWithFallback(playOptions)
      : await playWithFallback(playOptions);

    if (!result) {
      return;
    }

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

async function selectAndPlayWithFallback(options) {
  const searchResult = await searchWithFallback(options);

  if (searchResult.isEmpty()) {
    throw noResultError(options.query);
  }

  if (!shouldSelectSearchResult(searchResult)) {
    return playSearchResult(options, searchResult);
  }

  const selectedTrack = await chooseSearchResult(options, searchResult);

  if (!selectedTrack) {
    return null;
  }

  return playSelectedTrack(options, selectedTrack);
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
  return options.player.play(options.voiceChannel, options.query, playerPlayOptions(options, searchEngine));
}

async function playSearchResult(options, searchResult) {
  return options.player.play(options.voiceChannel, searchResult, playerPlayOptions(options));
}

async function playSelectedTrack(options, track) {
  if (!track.requestedBy) {
    track.requestedBy = options.interaction.user;
  }

  return options.player.play(options.voiceChannel, [track], playerPlayOptions(options));
}

async function searchWithFallback(options) {
  const result = await searchWithSearchEngine(options, options.primarySearchEngine);

  if (!result.isEmpty() || !options.fallbackSearchEngine) {
    return result;
  }

  console.warn(`No Spotify results for "${options.query}". Falling back to YouTube search.`);
  await options.playbackStatus.update(statusMessage(
    'Trying YouTube',
    'Spotify returned no results for that search. Trying YouTube instead.',
    'warning'
  ), 'pending');

  return searchWithSearchEngine(options, options.fallbackSearchEngine);
}

async function searchWithSearchEngine(options, searchEngine) {
  return options.player.search(options.query, {
    requestedBy: options.interaction.user,
    searchEngine
  });
}

function playerPlayOptions(options, searchEngine) {
  return {
    requestedBy: options.interaction.user,
    ...(searchEngine === undefined ? {} : { searchEngine }),
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
  };
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

function noResultError(query) {
  const error = new Error(`No results found for "${query}".`);
  error.code = 'ERR_NO_RESULT';
  return error;
}

function shouldSelectSearchResult(searchResult) {
  return !searchResult.playlist && (searchResult.tracks?.length ?? 0) > 1;
}

async function chooseSearchResult(options, searchResult) {
  const tracks = searchResult.tracks.slice(0, SEARCH_SELECTION_LIMIT);
  const customId = `${SEARCH_SELECTION_PREFIX}:${options.interaction.id ?? `${options.interaction.guildId}:${Date.now()}`}`;
  const message = await options.playbackStatus.update(searchSelectionMessage(tracks, customId), 'pending');

  if (!message?.createMessageComponentCollector) {
    console.warn('Search result picker is unavailable. Falling back to the first result.');
    return tracks[0] ?? null;
  }

  const selection = await waitForSearchSelection(message, customId, options.interaction.user.id);

  if (!selection) {
    await options.playbackStatus.update(statusMessage('Search timed out', 'No track was queued.', 'idle'), 'idle');
    return null;
  }

  await selection.deferUpdate();

  if (selection.values?.[0] === 'cancel') {
    await options.playbackStatus.update(statusMessage('Search cancelled', 'No track was queued.', 'idle'), 'idle');
    return null;
  }

  const selectedTrack = tracks[Number.parseInt(selection.values?.[0], 10)];

  if (!selectedTrack) {
    await options.playbackStatus.update(statusMessage('Search expired', 'That search result is no longer available.', 'warning'), 'idle');
    return null;
  }

  await options.playbackStatus.update(statusMessage(
    'Selected track',
    `Queueing ${trackMarkdown(selectedTrack)}.`,
    'info'
  ), 'pending');
  return selectedTrack;
}

function searchSelectionMessage(tracks, customId) {
  return {
    ...statusMessage(
      'Choose track',
      `Select one of the top ${tracks.length} search results within ${SEARCH_SELECTION_TIMEOUT_MS / 1000} seconds.`,
      'info'
    ),
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(customId)
          .setPlaceholder('Choose a track')
          .addOptions([
            ...tracks.map((track, index) => ({
              label: selectLabel(track, index),
              description: selectDescription(track),
              value: String(index)
            })),
            {
              label: 'Cancel',
              description: 'Do not queue a track',
              value: 'cancel'
            }
          ])
      )
    ]
  };
}

function waitForSearchSelection(message, customId, userId) {
  return new Promise((resolve) => {
    let settled = false;
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      filter: (componentInteraction) => componentInteraction.customId === customId,
      time: SEARCH_SELECTION_TIMEOUT_MS
    });

    collector.on('collect', async (componentInteraction) => {
      if (componentInteraction.user.id !== userId) {
        await componentInteraction.reply({
          ...statusMessage('Search belongs to someone else', 'Only the user who ran `/play` can choose this result.', 'warning'),
          flags: MessageFlags.Ephemeral
        }).catch((error) => {
          console.error('Failed to send search picker ownership reply:', error);
        });
        return;
      }

      settled = true;
      resolve(componentInteraction);
      collector.stop('selected');
    });

    collector.on('end', () => {
      if (!settled) {
        resolve(null);
      }
    });
  });
}

function selectLabel(track, index) {
  return trimSelectText(`${index + 1}. ${cleanTrackTitle(track) || 'Unknown track'}`, 100);
}

function selectDescription(track) {
  const details = [
    cleanAuthorName(track.author),
    track.duration,
    trackSource(track)
  ].filter(Boolean).join(' | ');

  return trimSelectText(details || track.url || 'Track result', 100);
}

function trackSource(track) {
  return plainText(track.source ?? track.extractor?.identifier ?? '');
}

function trimSelectText(value, limit) {
  const text = plainText(value);

  if (text.length <= limit) {
    return text || 'Unknown';
  }

  return `${text.slice(0, limit - 3).trimEnd()}...`;
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

  return addedTrackMessage(result, result.track?.requestedBy ?? result.queue?.metadata?.requestedBy);
}
