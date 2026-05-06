import { SlashCommandBuilder } from 'discord.js';
import { QueueRepeatMode, useMainPlayer } from 'discord-player';
import { trackMarkdown } from '../lib/format.js';
import { isAutoplayEnabled } from '../lib/guild-settings.js';
import { createPlaybackStatus } from '../lib/playback-status.js';
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
    await respond(interaction, voice.message);
    return;
  }

  const query = normalizeYouTubeUrl(interaction.options.getString('query', true));
  const player = useMainPlayer();

  await interaction.deferReply();
  const playbackStatus = createPlaybackStatus(interaction);

  try {
    const result = await player.play(voice.voiceChannel, query, {
      requestedBy: interaction.user,
      nodeOptions: {
        metadata: {
          textChannel: interaction.channel,
          requestedBy: interaction.user,
          playbackStatus
        },
        bufferingTimeout: 15000,
        leaveOnStop: true,
        leaveOnStopCooldown: 5000,
        leaveOnEnd: true,
        leaveOnEndCooldown: 15000,
        leaveOnEmpty: true,
        leaveOnEmptyCooldown: 300000,
        skipOnNoStream: true,
        repeatMode: isAutoplayEnabled(interaction.guildId)
          ? QueueRepeatMode.AUTOPLAY
          : QueueRepeatMode.OFF,
        volume: 75
      }
    });

    setQueueMetadata(result.queue, {
      textChannel: interaction.channel,
      requestedBy: interaction.user,
      playbackStatus
    });

    if (playbackStatus.state !== 'playing') {
      await playbackStatus.update(playResultMessage(result), 'queued');
    }
  } catch (error) {
    console.error('Play command failed:', error);
    await playbackStatus.update('Could not play that request. Try a YouTube URL/search, direct audio URL, SoundCloud, Vimeo, or Reverbnation source.', 'error');
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

function playResultMessage(result) {
  const playlist = result.searchResult?.playlist;
  const trackCount = result.searchResult?.tracks?.length ?? 1;

  if (playlist && trackCount > 1) {
    return `Queued ${trackCount} tracks from **${playlist.title}**.\nFirst: ${trackMarkdown(result.track)}`;
  }

  return `Queued: ${trackMarkdown(result.track)}`;
}

function normalizeYouTubeUrl(query) {
  try {
    const url = new URL(query);
    const hostname = url.hostname.toLowerCase();

    if (hostname === 'music.youtube.com' || hostname === 'm.youtube.com') {
      url.hostname = 'www.youtube.com';
      return url.toString();
    }
  } catch {
    return query;
  }

  return query;
}
