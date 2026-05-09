import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { QueueRepeatMode } from 'discord-player';
import { statusMessage } from './embeds.js';
import { MUSIC_CONTROL_IDS, MUSIC_CONTROL_PREFIX } from './music-components.js';
import { respond } from './replies.js';
import { requireSameVoiceChannel } from './voice.js';

export const LEAVE_USER_ID = '399562405249810433';

export function isMusicControlInteraction(interaction) {
  return interaction.isButton()
    && typeof interaction.customId === 'string'
    && interaction.customId.startsWith(`${MUSIC_CONTROL_PREFIX}:`);
}

export async function handleMusicControlInteraction(interaction, player, isAuthorized) {
  if (!interaction.inGuild()) {
    await replyEphemeral(interaction, statusMessage('Server only', 'Music controls only work inside a server.', 'warning'));
    return;
  }

  if (!isAuthorized(interaction)) {
    await replyEphemeral(interaction, statusMessage('Permission denied', 'You do not have permission to use this bot.', 'error'));
    return;
  }

  const queue = player.nodes.get(interaction.guildId);

  if (!queue) {
    await replyEphemeral(interaction, statusMessage('No active session', 'This server does not have an active player session.', 'warning'));
    return;
  }

  const voice = await requireSameVoiceChannel(interaction, queue);

  if (!voice.ok) {
    await replyEphemeral(interaction, statusMessage('Voice required', voice.message, 'warning'));
    return;
  }

  switch (interaction.customId) {
    case MUSIC_CONTROL_IDS.previous:
      await previousTrack(interaction, queue);
      return;
    case MUSIC_CONTROL_IDS.pause:
      await pauseOrResume(interaction, queue);
      return;
    case MUSIC_CONTROL_IDS.skip:
      await skipTrack(interaction, queue);
      return;
    case MUSIC_CONTROL_IDS.stop:
      await stopPlayback(interaction, queue);
      return;
    default:
      await replyEphemeral(interaction, statusMessage('Unknown command', 'Unknown music control.', 'warning'));
  }
}

export function stopQueuePlayback(queue) {
  queue.options.leaveOnStop = false;
  queue.setRepeatMode(QueueRepeatMode.OFF);
  return queue.node.stop(false);
}

export function clearUpcomingTracks(queue) {
  const clearedCount = queue?.tracks?.size ?? queue?.tracks?.toArray?.().length ?? 0;
  const repeatModeCleared = queue?.repeatMode !== undefined && queue.repeatMode !== QueueRepeatMode.OFF;

  queue?.tracks?.clear?.();

  if (repeatModeCleared) {
    queue.setRepeatMode(QueueRepeatMode.OFF);
  }

  return {
    clearedCount,
    repeatModeCleared
  };
}

export function isLeaveAuthorized(interaction) {
  if (leaveUserIds().has(interaction.user?.id)) {
    return true;
  }

  if (interaction.memberPermissions?.has?.(PermissionFlagsBits.ManageGuild)) {
    return true;
  }

  const allowedRoleIds = authorizedRoleIds();

  if (allowedRoleIds.size === 0) {
    return false;
  }

  const roles = interaction.member?.roles;

  if (Array.isArray(roles)) {
    return roles.some((roleId) => allowedRoleIds.has(roleId));
  }

  return Boolean(roles?.cache?.some((role) => allowedRoleIds.has(role.id)));
}

function leaveUserIds() {
  return new Set(parseIds(`${LEAVE_USER_ID},${process.env.LEAVE_USER_IDS ?? ''},${process.env.BOT_OWNER_IDS ?? ''}`));
}

function authorizedRoleIds() {
  return new Set(parseIds(`${process.env.AUTHORIZED_ROLE_IDS ?? ''},${process.env.ALLOWED_ROLE_IDS ?? ''}`));
}

function parseIds(value) {
  return String(value ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

async function previousTrack(interaction, queue) {
  try {
    if (!queue.history) {
      throw new Error('No queue history is available.');
    }

    await queue.history.previous();
    await replyEphemeral(interaction, statusMessage('Previous track', 'Playing the previous track.', 'skipped'));
  } catch (error) {
    console.error('Previous button failed:', error);
    await replyEphemeral(interaction, statusMessage('No previous track', 'There is no previous track to play.', 'idle'));
  }
}

async function pauseOrResume(interaction, queue) {
  if (!queue.isPlaying()) {
    await replyEphemeral(interaction, statusMessage('Nothing playing', 'Nothing is playing right now.', 'idle'));
    return;
  }

  const wasPaused = queue.node.isPaused();
  queue.node.setPaused(!wasPaused);

  await replyEphemeral(interaction, statusMessage(
    wasPaused ? 'Resumed' : 'Paused',
    wasPaused ? 'Resumed playback.' : 'Paused playback.',
    wasPaused ? 'success' : 'warning'
  ));
}

async function skipTrack(interaction, queue) {
  if (!queue.isPlaying()) {
    await replyEphemeral(interaction, statusMessage('Nothing playing', 'Nothing is playing right now.', 'idle'));
    return;
  }

  queue.node.skip();
  await replyEphemeral(interaction, statusMessage('Skipped', 'Skipped the current track.', 'skipped'));
}

async function stopPlayback(interaction, queue) {
  stopQueuePlayback(queue);
  await replyEphemeral(interaction, statusMessage('Stopped', 'Stopped playback. I will stay in the voice channel.', 'stopped'));
}

async function replyEphemeral(interaction, payload) {
  await respond(interaction, {
    ...payload,
    flags: MessageFlags.Ephemeral
  });
}
