import dotenv from 'dotenv';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import { ActivityType, Client, Collection, Events, GatewayIntentBits } from 'discord.js';
import { Player } from 'discord-player';
import { DefaultExtractors } from '@discord-player/extractor';
import { loadCommands } from './lib/command-loader.js';
import { respond, suppressEmbeds } from './lib/replies.js';
import { trackMarkdown, trackTitle } from './lib/format.js';

dotenv.config({ quiet: true });

if (!process.env.DISCORD_TOKEN) {
  throw new Error('DISCORD_TOKEN must be set in .env.');
}

if (!process.env.FFMPEG_PATH && ffmpeg.path) {
  process.env.FFMPEG_PATH = ffmpeg.path;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

client.commands = new Collection();
const activeTracks = new Map();

const player = new Player(client);
process.env.DOTENV_CONFIG_QUIET ??= 'true';
const { YoutubeExtractor } = await import('discord-player-youtube');
await player.extractors.register(YoutubeExtractor, {
  cookie: process.env.YOUTUBE_COOKIE,
  filterAutoplayTracks: true,
  priority: 2
});

if (!process.env.YOUTUBE_COOKIE?.trim()) {
  console.warn('YOUTUBE_COOKIE is not set. Some YouTube and YouTube Music streams may fail with a sign-in required error.');
}

await player.extractors.loadMulti(DefaultExtractors);

for (const command of await loadCommands()) {
  client.commands.set(command.data.name, command);
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}.`);
  console.log(`Loaded ${client.commands.size} commands.`);
  updatePresence();
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  if (!interaction.inGuild()) {
    await respond(interaction, 'Music commands only work inside a server.');
    return;
  }

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    await respond(interaction, `Unknown command: ${interaction.commandName}`);
    return;
  }

  try {
    await player.context.provide({ guild: interaction.guild }, () => command.execute(interaction));
  } catch (error) {
    console.error(`Command ${interaction.commandName} failed:`, error);
    await respond(interaction, 'That command failed. Check the bot logs for details.');
  }
});

player.events.on('playerStart', async (queue, track) => {
  setActiveTrack(queue, track);
  await updatePlaybackMessage(queue, `Now playing: ${trackMarkdown(track)}`, 'playing');
});

player.events.on('playerSkip', async (queue, track) => {
  await updatePlaybackMessage(queue, `Skipped ${trackMarkdown(track)} because the stream could not be loaded.`, 'skipped');
});

player.events.on('emptyQueue', async (queue) => {
  clearActiveTrack(queue);
  await updatePlaybackMessage(queue, 'Queue finished.', 'idle');
});

player.events.on('emptyChannel', async (queue) => {
  clearActiveTrack(queue);
  await updatePlaybackMessage(queue, 'Voice channel is empty, leaving.', 'idle');
});

player.events.on('disconnect', (queue) => {
  clearActiveTrack(queue);
});

player.events.on('queueDelete', (queue) => {
  clearActiveTrack(queue);
});

player.events.on('error', (queue, error) => {
  console.error(`Queue error in ${queue.guild?.name ?? queue.guild?.id ?? 'unknown guild'}:`, error);
});

player.events.on('playerError', async (queue, error) => {
  console.error(`Player error in ${queue.guild?.name ?? queue.guild?.id ?? 'unknown guild'}:`, error);
  await updatePlaybackMessage(queue, playbackErrorMessage(error), 'error');
});

player.on('debug', (message) => {
  if (process.env.DEBUG_PLAYER === 'true') {
    console.log(`[player] ${message}`);
  }
});

player.events.on('debug', (queue, message) => {
  if (process.env.DEBUG_PLAYER === 'true') {
    console.log(`[queue:${queue.guild?.id ?? 'unknown'}] ${message}`);
  }
});

await client.login(process.env.DISCORD_TOKEN);

async function updatePlaybackMessage(queue, content, state) {
  const playbackStatus = queue.metadata?.playbackStatus;

  if (playbackStatus && await playbackStatus.update(content, state)) {
    return;
  }

  await sendQueueMessage(queue, content);
}

async function sendQueueMessage(queue, content) {
  const channel = queue.metadata?.send
    ? queue.metadata
    : queue.metadata?.textChannel;

  if (!channel?.send) {
    return;
  }

  try {
    await channel.send(suppressEmbeds(content));
  } catch (error) {
    console.error('Failed to send queue message:', error);
  }
}

function setActiveTrack(queue, track) {
  const guildId = queue.guild?.id;

  if (!guildId) {
    return;
  }

  activeTracks.delete(guildId);
  activeTracks.set(guildId, track);
  updatePresence();
}

function clearActiveTrack(queue) {
  const guildId = queue.guild?.id;

  if (!guildId || !activeTracks.delete(guildId)) {
    return;
  }

  updatePresence();
}

function updatePresence() {
  if (!client.user) {
    return;
  }

  const track = [...activeTracks.values()].at(-1);

  if (!track) {
    client.user.setPresence({
      activities: [],
      status: 'online'
    });
    return;
  }

  client.user.setPresence({
    activities: [
      {
        name: presenceName(track),
        state: presenceState(track),
        type: ActivityType.Listening
      }
    ],
    status: 'online'
  });
}

function presenceName(track) {
  return truncatePresence(cleanTrackTitle(track), 128);
}

function presenceState(track) {
  const author = cleanAuthorName(track.author);
  const requester = requesterName(track);

  return truncatePresence(author
    ? `by ${author} - requested by ${requester}`
    : `requested by ${requester}`, 128);
}

function cleanTrackTitle(track) {
  const title = removeVideoNoise(plainText(trackTitle(track)));
  const author = cleanAuthorName(track.author);

  if (!author) {
    return title;
  }

  return stripAuthorPrefix(title, author);
}

function requesterName(track) {
  const user = track.requestedBy;

  return plainText(user?.globalName ?? user?.username ?? 'autoplay');
}

function plainText(value) {
  return String(value)
    .replace(/\s+/g, ' ')
    .trim();
}

function truncatePresence(value, limit) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit - 3).trimEnd()}...`;
}

function stripAuthorPrefix(title, author) {
  for (const separator of [' - ', ' \u2013 ', ' \u2014 ', ' | ', ': ']) {
    const prefix = `${author}${separator}`;

    if (title.toLowerCase().startsWith(prefix.toLowerCase())) {
      return title.slice(prefix.length).trim();
    }
  }

  return title;
}

function cleanAuthorName(author) {
  return removeVideoNoise(plainText(author ?? ''))
    .replace(/\s+-\s+topic$/i, '')
    .trim();
}

function removeVideoNoise(value) {
  return value
    .replace(/\s*[\[(](official\s+)?(music\s+)?(lyric\s+)?video[\])]/gi, '')
    .replace(/\s*[\[(]lyrics?[\])]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function playbackErrorMessage(error) {
  const message = String(error?.message ?? error).toLowerCase();

  if (message.includes('signed in')) {
    return 'YouTube blocked this stream because the bot is not signed in. Add `YOUTUBE_COOKIE` to `.env`, restart the bot, then try again.';
  }

  return 'Playback failed for this track. Check the bot logs for details.';
}
