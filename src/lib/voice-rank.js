import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const defaultVoiceStatsPath = path.join(projectRoot, 'data', 'voice-stats.json');
const guildVoiceStats = new Map();
let loaded = false;
let loadPromise = null;
let writePromise = Promise.resolve();

export async function loadVoiceStats() {
  if (loaded) {
    return;
  }

  loadPromise ??= readVoiceStatsFile();

  try {
    await loadPromise;
  } catch (error) {
    loadPromise = null;
    throw error;
  }
}

export async function initializeActiveVoiceSessions(client, now = Date.now()) {
  await loadVoiceStats();

  for (const guild of client.guilds.cache.values()) {
    for (const voiceState of guild.voiceStates.cache.values()) {
      const info = voiceStateInfo(voiceState);

      if (voiceState.channelId && info && !info.isBot) {
        startVoiceSession(info, now);
      }
    }
  }
}

export async function handleVoiceStateUpdate(oldState, newState, now = Date.now()) {
  await loadVoiceStats();
  const changed = applyVoiceStateUpdate(oldState, newState, now);

  if (changed) {
    await queueVoiceStatsWrite();
  }

  return changed;
}

export function applyVoiceStateUpdate(oldState, newState, now = Date.now()) {
  const oldChannelId = oldState?.channelId ?? null;
  const newChannelId = newState?.channelId ?? null;

  if (oldChannelId === newChannelId) {
    return false;
  }

  const info = voiceStateInfo(newChannelId ? newState : oldState);

  if (!info || info.isBot) {
    return false;
  }

  if (!oldChannelId && newChannelId) {
    startVoiceSession({ ...info, channelId: newChannelId }, now);
    return false;
  }

  if (oldChannelId && !newChannelId) {
    return endVoiceSession(info, now);
  }

  moveVoiceSession({ ...info, channelId: newChannelId }, now);
  return false;
}

export async function getVoiceRank(guildId, options = {}) {
  await loadVoiceStats();
  return voiceRank(guildId, options);
}

export function voiceRank(guildId, options = {}) {
  const guildStats = getGuildVoiceStats(guildId);
  const now = options.now ?? Date.now();
  const limit = clampLimit(options.limit ?? 10);
  const userIds = new Set([
    ...guildStats.users.keys(),
    ...guildStats.active.keys()
  ]);

  return [...userIds]
    .map((userId) => voiceRankEntry(guildStats, userId, now))
    .filter((entry) => entry.totalMs > 0 || entry.active)
    .sort((left, right) =>
      right.durationMs - left.durationMs
        || Number(right.active) - Number(left.active)
        || left.displayName.localeCompare(right.displayName)
    )
    .slice(0, limit);
}

export function activeVoiceSessionCount(guildId) {
  return getGuildVoiceStats(guildId).active.size;
}

export function formatVoiceDuration(durationMs) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor(totalSeconds % 86400 / 3600);
  const minutes = Math.floor(totalSeconds % 3600 / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

async function readVoiceStatsFile() {
  try {
    const raw = await readFile(voiceStatsPath(), 'utf8');
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Voice stats file must contain a JSON object.');
    }

    guildVoiceStats.clear();

    for (const [guildId, stats] of Object.entries(parsed)) {
      guildVoiceStats.set(guildId, normalizeGuildStats(stats));
    }
  } catch (error) {
    if (error?.code === 'ENOENT') {
      loaded = true;
      return;
    }

    throw new Error(`Failed to load voice stats: ${error.message}`);
  }

  loaded = true;
}

function normalizeGuildStats(stats = {}) {
  const users = new Map();
  const rawUsers = stats?.users && typeof stats.users === 'object'
    ? stats.users
    : {};

  for (const [userId, userStats] of Object.entries(rawUsers)) {
    users.set(userId, normalizeUserStats(userStats));
  }

  return {
    active: new Map(),
    users
  };
}

function normalizeUserStats(stats = {}) {
  return {
    displayName: normalizeDisplayName(stats.displayName),
    lastSeenAt: normalizeTimestamp(stats.lastSeenAt),
    totalMs: Math.max(0, Math.floor(Number(stats.totalMs) || 0))
  };
}

function getGuildVoiceStats(guildId) {
  const key = guildStatsKey(guildId);

  if (!guildVoiceStats.has(key)) {
    guildVoiceStats.set(key, {
      active: new Map(),
      users: new Map()
    });
  }

  return guildVoiceStats.get(key);
}

function getUserVoiceStats(guildStats, userId) {
  if (!guildStats.users.has(userId)) {
    guildStats.users.set(userId, normalizeUserStats());
  }

  return guildStats.users.get(userId);
}

function startVoiceSession(info, now) {
  const guildStats = getGuildVoiceStats(info.guildId);
  const userStats = getUserVoiceStats(guildStats, info.userId);

  userStats.displayName = info.displayName ?? userStats.displayName;

  if (!guildStats.active.has(info.userId)) {
    guildStats.active.set(info.userId, {
      channelId: info.channelId,
      displayName: info.displayName,
      joinedAt: now
    });
    return;
  }

  const active = guildStats.active.get(info.userId);
  active.channelId = info.channelId;
  active.displayName = info.displayName ?? active.displayName;
}

function endVoiceSession(info, now) {
  const guildStats = getGuildVoiceStats(info.guildId);
  const active = guildStats.active.get(info.userId);

  if (!active) {
    return false;
  }

  const userStats = getUserVoiceStats(guildStats, info.userId);

  userStats.displayName = info.displayName ?? active.displayName ?? userStats.displayName;
  userStats.lastSeenAt = now;
  userStats.totalMs += Math.max(0, now - active.joinedAt);
  guildStats.active.delete(info.userId);
  return true;
}

function moveVoiceSession(info, now) {
  const guildStats = getGuildVoiceStats(info.guildId);
  const active = guildStats.active.get(info.userId);

  if (!active) {
    startVoiceSession(info, now);
    return;
  }

  active.channelId = info.channelId;
  active.displayName = info.displayName ?? active.displayName;
  getUserVoiceStats(guildStats, info.userId).displayName = info.displayName ?? active.displayName;
}

function voiceRankEntry(guildStats, userId, now) {
  const userStats = getUserVoiceStats(guildStats, userId);
  const active = guildStats.active.get(userId) ?? null;
  const activeMs = active ? Math.max(0, now - active.joinedAt) : 0;

  return {
    active: Boolean(active),
    activeMs,
    channelId: active?.channelId ?? null,
    displayName: active?.displayName ?? userStats.displayName ?? userId,
    durationMs: userStats.totalMs + activeMs,
    totalMs: userStats.totalMs,
    userId
  };
}

function voiceStateInfo(state) {
  if (!state) {
    return null;
  }

  const user = state.member?.user ?? state.user ?? null;
  const userId = state.id ?? state.member?.id ?? user?.id;
  const guildId = state.guild?.id ?? state.guildId;

  if (!guildId || !userId) {
    return null;
  }

  return {
    channelId: state.channelId ?? null,
    displayName: normalizeDisplayName(state.member?.displayName ?? user?.globalName ?? user?.username),
    guildId: String(guildId),
    isBot: Boolean(user?.bot),
    userId: String(userId)
  };
}

function queueVoiceStatsWrite() {
  writePromise = writePromise.then(writeVoiceStatsFile, writeVoiceStatsFile);
  return writePromise;
}

async function writeVoiceStatsFile() {
  const filePath = voiceStatsPath();
  const tempPath = `${filePath}.tmp`;
  const data = Object.fromEntries(
    [...guildVoiceStats.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([guildId, stats]) => [guildId, serializeGuildStats(stats)])
  );

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`);
  await rename(tempPath, filePath);
}

function serializeGuildStats(stats) {
  return {
    users: Object.fromEntries(
      [...stats.users.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([userId, userStats]) => [userId, {
          displayName: userStats.displayName,
          lastSeenAt: userStats.lastSeenAt,
          totalMs: userStats.totalMs
        }])
    )
  };
}

function voiceStatsPath() {
  return path.resolve(process.env.VOICE_STATS_PATH?.trim() || defaultVoiceStatsPath);
}

function guildStatsKey(guildId) {
  if (!guildId) {
    throw new Error('guildId is required for voice stats.');
  }

  return String(guildId);
}

function normalizeDisplayName(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || null;
}

function normalizeTimestamp(value) {
  const timestamp = Math.floor(Number(value) || 0);
  return timestamp > 0 ? timestamp : null;
}

function clampLimit(value) {
  const limit = Math.floor(Number(value) || 10);
  return Math.max(1, Math.min(25, limit));
}
