import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { QueryType, QueueRepeatMode } from 'discord-player';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

export const DEFAULT_TTS_VOICE = 'id-ID-ArdiNeural';
export const MAX_TTS_TEXT_LENGTH = 1000;

const TTS_TEMP_ROOT = path.join(os.tmpdir(), 'asprisawi-tts');
const TTS_CLEANUP_DELAY_MS = 30000;
const YOUTUBE_EXTRACTOR_ID = 'com.mangod33.discord-player-youtube';
const cleanupTimers = new Map();

export function isAutomaticTtsConfigured() {
  return process.env.ENABLE_MESSAGE_CONTENT_INTENT === 'true';
}

export async function synthesizeTtsToFile({ text, voice }) {
  const normalizedText = normalizeTtsText(text);
  const normalizedVoice = normalizeTtsVoice(voice);
  const cleanupDir = path.join(TTS_TEMP_ROOT, randomUUID());
  const tts = new MsEdgeTTS({ enableLogger: process.env.DEBUG_TTS === 'true' });

  await mkdir(cleanupDir, { recursive: true });

  try {
    await tts.setMetadata(normalizedVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioFilePath } = await tts.toFile(cleanupDir, escapeSsmlText(normalizedText));

    return {
      cleanupDir,
      filePath: audioFilePath,
      text: normalizedText,
      voice: normalizedVoice
    };
  } catch (error) {
    await cleanupTtsArtifact({ cleanupDir });
    throw error;
  } finally {
    tts.close();
  }
}

export function normalizeTtsText(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();

  if (!text) {
    throw new Error('TTS text cannot be empty.');
  }

  if (text.length > MAX_TTS_TEXT_LENGTH) {
    throw new Error(`TTS text must be ${MAX_TTS_TEXT_LENGTH} characters or less.`);
  }

  return text;
}

export function normalizeTtsVoice(value) {
  const voice = String(value || process.env.TTS_VOICE || DEFAULT_TTS_VOICE).trim();

  if (!/^[A-Za-z0-9-]{2,100}$/.test(voice) || !/[a-z]{2}-[A-Z0-9]{2}/.test(voice)) {
    throw new Error('Voice must be an Edge TTS ShortName, like id-ID-ArdiNeural or en-US-AriaNeural.');
  }

  return voice;
}

export function escapeSsmlText(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function ttsTrackTitle(text, limit = 80) {
  const preview = normalizeTtsText(text);

  if (preview.length <= limit) {
    return `TTS: ${preview}`;
  }

  return `TTS: ${preview.slice(0, limit - 3).trimEnd()}...`;
}

export async function playTts({
  player,
  requestedBy,
  silent = false,
  text,
  textChannel,
  voice,
  voiceChannel
}) {
  const artifact = await synthesizeTtsToFile({ text, voice });

  try {
    const result = await player.play(voiceChannel, artifact.filePath, {
      requestedBy,
      searchEngine: QueryType.FILE,
      blockExtractors: [YOUTUBE_EXTRACTOR_ID],
      ignoreCache: true,
      afterSearch: (searchResult) => {
        applyTtsTrackMetadata(searchResult.tracks?.[0], artifact, { silent });
        return searchResult;
      },
      nodeOptions: {
        metadata: silent
          ? undefined
          : {
              textChannel,
              requestedBy
            },
        bufferingTimeout: 15000,
        leaveOnStop: false,
        leaveOnEnd: false,
        leaveOnEmpty: false,
        skipOnNoStream: true,
        repeatMode: QueueRepeatMode.OFF,
        volume: 75
      }
    });

    if (!silent) {
      setQueueMetadata(result.queue, {
        textChannel,
        requestedBy
      });
    }

    applyTtsTrackMetadata(result.track, artifact, { silent });
    return result;
  } catch (error) {
    await cleanupTtsArtifact(artifact);
    throw error;
  }
}

export function applyTtsTrackMetadata(track, artifact, options = {}) {
  if (!track) {
    return;
  }

  const metadata = track.metadata && typeof track.metadata === 'object'
    ? track.metadata
    : {};
  const title = ttsTrackTitle(artifact.text);

  track.title = title;
  track.author = `Edge TTS (${artifact.voice})`;
  track.url = '';
  track.description = `${title} by ${track.author}`;
  track.setMetadata({
    ...metadata,
    tts: {
      ...artifact,
      silent: Boolean(options.silent)
    }
  });
}

export function isSilentTtsTrack(track) {
  return Boolean(getTtsArtifact(track)?.silent);
}

export function scheduleTtsTrackCleanup(track, delayMs = TTS_CLEANUP_DELAY_MS) {
  const artifact = getTtsArtifact(track);

  if (!artifact?.cleanupDir || artifact.cleaned || cleanupTimers.has(artifact.cleanupDir)) {
    return false;
  }

  const timer = setTimeout(() => {
    cleanupTimers.delete(artifact.cleanupDir);
    cleanupTtsArtifact(artifact).catch((error) => {
      console.error('Failed to clean up TTS audio:', error);
    });
  }, delayMs);

  timer.unref?.();
  cleanupTimers.set(artifact.cleanupDir, timer);
  return true;
}

export async function cleanupTtsTrack(track) {
  const artifact = getTtsArtifact(track);

  if (!artifact) {
    return false;
  }

  return cleanupTtsArtifact(artifact);
}

export function scheduleTtsQueueCleanup(queue, delayMs = TTS_CLEANUP_DELAY_MS) {
  for (const track of collectQueueTracks(queue)) {
    scheduleTtsTrackCleanup(track, delayMs);
  }
}

export async function cleanupTtsArtifact(artifact) {
  if (!artifact?.cleanupDir || artifact.cleaned) {
    return false;
  }

  artifact.cleaned = true;

  const timer = cleanupTimers.get(artifact.cleanupDir);

  if (timer) {
    clearTimeout(timer);
    cleanupTimers.delete(artifact.cleanupDir);
  }

  await rm(artifact.cleanupDir, { recursive: true, force: true });
  return true;
}

function getTtsArtifact(track) {
  return track?.metadata?.tts ?? null;
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

function collectQueueTracks(queue) {
  const tracks = [
    queue?.currentTrack,
    queue?.history?.currentTrack,
    ...queueTrackList(queue)
  ].filter(Boolean);

  return [...new Set(tracks)];
}

function queueTrackList(queue) {
  if (!queue?.tracks?.toArray) {
    return [];
  }

  return queue.tracks.toArray();
}
