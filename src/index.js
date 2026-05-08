import dotenv from 'dotenv';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import { ActivityType, Client, Collection, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import { Player } from 'discord-player';
import { DefaultExtractors } from '@discord-player/extractor';
import { chooseAutoplayTrack } from './lib/autoplay.js';
import { loadCommands } from './lib/command-loader.js';
import { statusMessage, trackStatusMessage } from './lib/embeds.js';
import { getTtsSettings, loadGuildSettings } from './lib/guild-settings.js';
import { handleMusicControlInteraction, isMusicControlInteraction } from './lib/player-controls.js';
import { respond, safeRespond, suppressEmbeds } from './lib/replies.js';
import { askSawi, normalizeSawiQuestion } from './lib/sawi-ai.js';
import { cleanAuthorName, cleanTrackTitle, plainText } from './lib/track-cleanup.js';
import { cleanupTtsTrack, isAutomaticTtsConfigured, isSilentTtsTrack, MAX_TTS_TEXT_LENGTH, normalizeTtsText, playTts, scheduleTtsQueueCleanup, scheduleTtsTrackCleanup } from './lib/tts.js';
import { SpotifyAwareYoutubeExtractor } from './lib/youtube-extractor.js';

dotenv.config({ quiet: true });

if (!process.env.DISCORD_TOKEN) {
  throw new Error('DISCORD_TOKEN must be set in .env.');
}

if (!process.env.FFMPEG_PATH && ffmpeg.path) {
  process.env.FFMPEG_PATH = ffmpeg.path;
}

const clientIntents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildVoiceStates
];

if (isAutomaticTtsConfigured()) {
  clientIntents.push(GatewayIntentBits.MessageContent);
} else {
  console.warn('Automatic chat TTS is disabled. Set ENABLE_MESSAGE_CONTENT_INTENT=true after enabling Message Content Intent in the Discord Developer Portal. Mention/reply AI still works for messages Discord exposes to the bot.');
}

const client = new Client({ intents: clientIntents });

client.commands = new Collection();
const activeTracks = new Map();
const authorizedRoleIds = new Set(parseIds(`${process.env.AUTHORIZED_ROLE_IDS ?? ''},${process.env.ALLOWED_ROLE_IDS ?? ''}`));
const startedAt = Date.now();
const sawiMessageTasks = new Map();
const ttsMessageTasks = new Map();
let warnedMissingMessageContent = false;

const player = new Player(client);
await loadGuildSettings();
process.env.DOTENV_CONFIG_QUIET ??= 'true';
await player.extractors.register(SpotifyAwareYoutubeExtractor, {
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
  console.log(authorizedRoleIds.size > 0
    ? `Command access restricted to ${authorizedRoleIds.size} role ID(s).`
    : 'Command access is unrestricted. Set AUTHORIZED_ROLE_IDS to restrict it.');
  updatePresence();
  const presenceTimer = setInterval(updatePresence, 60000);
  presenceTimer.unref?.();
});

client.on(Events.Error, (error) => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

client.on(Events.InteractionCreate, (interaction) => {
  handleInteraction(interaction).catch((error) => {
    console.error('Interaction handler failed:', error);
  });
});

async function handleInteraction(interaction) {
  if (isMusicControlInteraction(interaction)) {
    try {
      await handleMusicControlInteraction(interaction, player, isAuthorizedInteraction);
    } catch (error) {
      console.error('Music control button failed:', error);
      await safeRespond(
        interaction,
        statusMessage('Command failed', 'That music control failed. Check the bot logs for details.', 'error'),
        'music control error response'
      );
    }
    return;
  }

  if (!interaction.isChatInputCommand()) {
    return;
  }

  if (!interaction.inGuild()) {
    await safeRespond(interaction, statusMessage('Server only', 'Music commands only work inside a server.', 'warning'));
    return;
  }

  if (interaction.commandName !== 'leave' && !isAuthorizedInteraction(interaction)) {
    await safeRespond(interaction, {
      ...statusMessage('Permission denied', 'You do not have permission to use this bot.', 'error'),
      flags: MessageFlags.Ephemeral
    }, 'permission denied response');
    return;
  }

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    await safeRespond(interaction, statusMessage('Unknown command', `Unknown command: ${interaction.commandName}`, 'warning'));
    return;
  }

  try {
    await player.context.provide({ guild: interaction.guild }, () => command.execute(interaction));
  } catch (error) {
    console.error(`Command ${interaction.commandName} failed:`, error);
    await safeRespond(
      interaction,
      statusMessage('Command failed', 'That command failed. Check the bot logs for details.', 'error'),
      `${interaction.commandName} error response`
    );
  }
}

client.on(Events.MessageCreate, async (message) => {
  if (await handleSawiMessage(message)) {
    return;
  }

  if (!shouldQueueTtsMessage(message)) {
    return;
  }

  queueTtsMessage(message);
});

player.events.on('playerStart', async (queue, track) => {
  setActiveTrack(queue, track);

  if (isSilentTtsTrack(track)) {
    return;
  }

  await updateTrackMessage(queue, track, trackStatusMessage('Now playing', track, 'playing', {
    controls: true
  }), 'playing');
});

player.events.on('willAutoPlay', async (queue, tracks, done) => {
  try {
    done(await chooseAutoplayTrack(queue, tracks));
  } catch (error) {
    console.error('Autoplay selection failed:', error);
    done(null);
  }
});

player.events.on('playerSkip', async (queue, track) => {
  if (!isSilentTtsTrack(track)) {
    await updateTrackMessage(queue, track, trackStatusMessage('Skipped', track, 'skipped', {
      footer: 'The stream could not be loaded.'
    }), 'skipped');
  }

  scheduleTtsTrackCleanup(track);
});

player.events.on('playerFinish', (queue, track) => {
  scheduleTtsTrackCleanup(track);
});

player.events.on('emptyQueue', async (queue) => {
  clearActiveTrack(queue);

  if (isSilentTtsTrack(queue.history?.currentTrack ?? queue.currentTrack)) {
    return;
  }

  await sendQueueMessage(queue, statusMessage('Queue finished', 'There are no more tracks queued.', 'idle'));
});

player.events.on('emptyChannel', async (queue) => {
  clearActiveTrack(queue);

  if (isSilentTtsTrack(queue.history?.currentTrack ?? queue.currentTrack)) {
    return;
  }

  await sendQueueMessage(queue, statusMessage('Voice channel empty', 'Voice channel is empty.', 'idle'));
});

player.events.on('disconnect', (queue) => {
  scheduleTtsQueueCleanup(queue);
  clearActiveTrack(queue);
});

player.events.on('queueDelete', (queue) => {
  scheduleTtsQueueCleanup(queue);
  clearActiveTrack(queue);
});

player.events.on('error', (queue, error) => {
  console.error(`Queue error in ${queue.guild?.name ?? queue.guild?.id ?? 'unknown guild'}:`, error);
});

player.events.on('playerError', async (queue, error) => {
  console.error(`Player error in ${queue.guild?.name ?? queue.guild?.id ?? 'unknown guild'}:`, error);
  const track = queue.history?.currentTrack;

  if (!isSilentTtsTrack(track)) {
    await updateTrackMessage(queue, track, statusMessage('Playback failed', playbackErrorMessage(error), 'error'), 'error');
  }

  await cleanupTtsTrack(track);
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

function isAuthorizedInteraction(interaction) {
  if (authorizedRoleIds.size === 0) {
    return true;
  }

  const roles = interaction.member?.roles;

  if (Array.isArray(roles)) {
    return roles.some((roleId) => authorizedRoleIds.has(roleId));
  }

  return Boolean(roles?.cache?.some((role) => authorizedRoleIds.has(role.id)));
}

function parseIds(value) {
  return String(value ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function shouldQueueTtsMessage(message) {
  if (!message.guildId || message.author?.bot || message.webhookId || message.system) {
    return false;
  }

  const settings = getTtsSettings(message.guildId);

  return Boolean(
    isAutomaticTtsConfigured()
      && settings.enabled
      && settings.textChannelId === message.channelId
      && settings.voiceChannelId
  );
}

async function handleSawiMessage(message) {
  if (!shouldAnswerSawiMessage(message)) {
    return false;
  }

  const context = await sawiMessageContext(message);

  if (!context.triggered) {
    return false;
  }

  const question = sawiMessageQuestion(message);

  if (!question) {
    await message.reply(statusMessage(
      'Sawi is listening',
      'Sawi can see you calling her, but she cannot read the question text. Mention Sawi in the message, or enable Message Content Intent for non-mention replies.',
      'warning'
    )).catch((error) => {
      console.error('Failed to send Sawi setup reply:', error);
    });
    return true;
  }

  queueSawiMessage(message, question, context.previousAssistantMessage);
  return true;
}

function shouldAnswerSawiMessage(message) {
  return Boolean(
    message.guildId
      && !message.author?.bot
      && !message.webhookId
      && !message.system
      && isAuthorizedMessage(message)
  );
}

function isAuthorizedMessage(message) {
  if (authorizedRoleIds.size === 0) {
    return true;
  }

  return Boolean(message.member?.roles?.cache?.some((role) => authorizedRoleIds.has(role.id)));
}

async function sawiMessageContext(message) {
  if (messageMentionsBot(message)) {
    return {
      previousAssistantMessage: null,
      triggered: true
    };
  }

  const referencedMessage = await fetchReferencedMessage(message);

  if (!isSawiBotMessage(referencedMessage)) {
    return {
      previousAssistantMessage: null,
      triggered: false
    };
  }

  return {
    previousAssistantMessage: botMessageText(referencedMessage),
    triggered: true
  };
}

function messageMentionsBot(message) {
  return Boolean(client.user?.id && message.mentions?.users?.has(client.user.id));
}

async function fetchReferencedMessage(message) {
  if (!message.reference?.messageId || !message.fetchReference) {
    return null;
  }

  return message.fetchReference().catch(() => null);
}

function isSawiBotMessage(message) {
  if (!message || message.author?.id !== client.user?.id) {
    return false;
  }

  return message.embeds?.some((embed) => String(embed.title ?? '').startsWith('Sawi')) ?? false;
}

function botMessageText(message) {
  const content = String(message.cleanContent || message.content || '').trim();

  if (content) {
    return content;
  }

  return message.embeds
    ?.map((embed) => [embed.title, embed.description].filter(Boolean).join('\n'))
    .filter(Boolean)
    .join('\n\n') ?? '';
}

function sawiMessageQuestion(message) {
  const rawContent = String(message.content || message.cleanContent || '').trim();

  if (!rawContent) {
    return null;
  }

  const mentionPattern = client.user?.id
    ? new RegExp(`<@!?${client.user.id}>`, 'g')
    : null;
  const withoutMention = mentionPattern
    ? rawContent.replace(mentionPattern, ' ')
    : rawContent;

  try {
    return normalizeSawiQuestion(withoutMention);
  } catch {
    return null;
  }
}

function queueSawiMessage(message, question, previousAssistantMessage) {
  const previousTask = sawiMessageTasks.get(message.guildId) ?? Promise.resolve();
  const nextTask = previousTask
    .catch(() => {})
    .then(() => replyToSawiMessage(message, question, previousAssistantMessage));

  sawiMessageTasks.set(message.guildId, nextTask);
  nextTask.finally(() => {
    if (sawiMessageTasks.get(message.guildId) === nextTask) {
      sawiMessageTasks.delete(message.guildId);
    }
  });
}

async function replyToSawiMessage(message, question, previousAssistantMessage) {
  try {
    await message.channel?.sendTyping?.();
    const answer = await askSawi(question, { previousAssistantMessage });
    await message.reply(statusMessage('Sawi says', answer, 'success'));
  } catch (error) {
    console.error(`Sawi message reply failed in ${message.guild?.name ?? message.guildId}:`, error);
    await message.reply(statusMessage('Sawi is resting', sawiMessageError(error), 'error')).catch((replyError) => {
      console.error('Failed to send Sawi error reply:', replyError);
    });
  }
}

function sawiMessageError(error) {
  const message = String(error?.message ?? error);

  if (message.includes('GROQ_API_KEY')) {
    return 'Sawi needs `GROQ_API_KEY` in `.env` before she can answer questions.';
  }

  return 'Sawi could not answer right now. Check the bot logs for details.';
}

function queueTtsMessage(message) {
  const previousTask = ttsMessageTasks.get(message.guildId) ?? Promise.resolve();
  const nextTask = previousTask
    .catch(() => {})
    .then(() => speakTtsMessage(message));

  ttsMessageTasks.set(message.guildId, nextTask);
  nextTask.finally(() => {
    if (ttsMessageTasks.get(message.guildId) === nextTask) {
      ttsMessageTasks.delete(message.guildId);
    }
  });
}

async function speakTtsMessage(message) {
  const settings = getTtsSettings(message.guildId);

  if (!settings.enabled || settings.textChannelId !== message.channelId || !settings.voiceChannelId) {
    return;
  }

  const text = ttsMessageText(message);

  if (!text) {
    return;
  }

  const voiceChannel = await resolveVoiceChannel(message.guild, settings.voiceChannelId);

  if (!voiceChannel) {
    console.warn(`TTS voice channel ${settings.voiceChannelId} was not found in guild ${message.guildId}.`);
    return;
  }

  try {
    await playTts({
      player,
      requestedBy: message.author,
      silent: true,
      text,
      voice: settings.voice,
      voiceChannel
    });
  } catch (error) {
    console.error(`Automatic TTS failed in ${message.guild?.name ?? message.guildId}:`, error);
  }
}

function ttsMessageText(message) {
  const content = String(message.cleanContent || message.content || '').trim();

  if (!content) {
    if (!warnedMissingMessageContent) {
      console.warn('TTS is enabled but message content was empty. Enable the Message Content Intent in the Discord Developer Portal if normal text messages are not being read.');
      warnedMissingMessageContent = true;
    }

    return null;
  }

  return normalizeTtsText(content.slice(0, MAX_TTS_TEXT_LENGTH));
}

async function resolveVoiceChannel(guild, channelId) {
  const channel = guild.channels.cache.get(channelId)
    ?? await guild.channels.fetch(channelId).catch(() => null);

  return channel?.isVoiceBased?.() ? channel : null;
}

async function updateTrackMessage(queue, track, content, state) {
  const playbackStatus = track?.metadata?.playbackStatus;

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
      activities: [
        {
          name: `/play | up ${formatUptime()}`,
          type: ActivityType.Watching
        }
      ],
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
  const uptime = ` | up ${formatUptime()}`;
  const text = author
    ? `by ${author} | req: ${requester}`
    : `req: ${requester}`;

  return truncateWithSuffix(text, uptime, 128);
}

function requesterName(track) {
  const user = track.requestedBy;

  return plainText(user?.globalName ?? user?.username ?? 'autoplay');
}

function truncatePresence(value, limit) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit - 3).trimEnd()}...`;
}

function truncateWithSuffix(value, suffix, limit) {
  const content = `${value}${suffix}`;

  if (content.length <= limit) {
    return content;
  }

  const available = limit - suffix.length;

  if (available <= 3) {
    return truncatePresence(content, limit);
  }

  return `${value.slice(0, available - 3).trimEnd()}...${suffix}`;
}

function formatUptime() {
  const totalSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor(totalSeconds % 86400 / 3600);
  const minutes = Math.floor(totalSeconds % 3600 / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${seconds}s`;
}

function playbackErrorMessage(error) {
  const message = String(error?.message ?? error).toLowerCase();

  if (message.includes('signed in')) {
    return 'YouTube blocked this stream because the bot is not signed in. Add `YOUTUBE_COOKIE` to `.env`, restart the bot, then try again.';
  }

  return 'Playback failed for this track. Check the bot logs for details.';
}
