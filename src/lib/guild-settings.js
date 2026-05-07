import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const defaultSettingsPath = path.join(projectRoot, 'data', 'guild-settings.json');
export const DEFAULT_SEARCH_SOURCE = 'spotify';
export const SEARCH_SOURCES = new Set(['auto', 'spotify', 'youtube']);
const guildSettings = new Map();
let loaded = false;
let loadPromise = null;
let writePromise = Promise.resolve();

export async function loadGuildSettings() {
  if (loaded) {
    return;
  }

  loadPromise ??= readSettingsFile();

  try {
    await loadPromise;
  } catch (error) {
    loadPromise = null;
    throw error;
  }
}

export function getGuildSettings(guildId) {
  const key = guildSettingsKey(guildId);

  if (!guildSettings.has(key)) {
    guildSettings.set(key, defaultGuildSettings());
  }

  return guildSettings.get(key);
}

export function isAutoplayEnabled(guildId) {
  return getGuildSettings(guildId).autoplay;
}

export async function setAutoplayEnabled(guildId, enabled) {
  const settings = getGuildSettings(guildId);
  settings.autoplay = Boolean(enabled);
  await queueSettingsWrite();
  return settings.autoplay;
}

export function getDefaultSearchSource(guildId) {
  return getGuildSettings(guildId).defaultSearchSource;
}

export async function setDefaultSearchSource(guildId, source) {
  const settings = getGuildSettings(guildId);
  settings.defaultSearchSource = normalizeSearchSource(source);
  await queueSettingsWrite();
  return settings.defaultSearchSource;
}

export function getTtsSettings(guildId) {
  return getGuildSettings(guildId).tts;
}

export function isTtsEnabled(guildId) {
  return getTtsSettings(guildId).enabled;
}

export async function setTtsSettings(guildId, nextTtsSettings) {
  const settings = getGuildSettings(guildId);

  settings.tts = normalizeTtsSettings({
    ...settings.tts,
    ...nextTtsSettings
  });
  await queueSettingsWrite();
  return settings.tts;
}

async function readSettingsFile() {
  try {
    const raw = await readFile(settingsPath(), 'utf8');
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Settings file must contain a JSON object.');
    }

    guildSettings.clear();

    for (const [guildId, settings] of Object.entries(parsed)) {
      if (settings && typeof settings === 'object') {
        guildSettings.set(guildId, normalizeSettings(settings));
      }
    }
  } catch (error) {
    if (error?.code === 'ENOENT') {
      loaded = true;
      return;
    }

    throw new Error(`Failed to load guild settings: ${error.message}`);
  }

  loaded = true;
}

function normalizeSettings(settings = {}) {
  return {
    ...defaultGuildSettings(),
    autoplay: Boolean(settings.autoplay),
    defaultSearchSource: normalizeSearchSource(settings.defaultSearchSource),
    tts: normalizeTtsSettings(settings.tts)
  };
}

function defaultGuildSettings() {
  return {
    autoplay: false,
    defaultSearchSource: DEFAULT_SEARCH_SOURCE,
    tts: normalizeTtsSettings()
  };
}

function normalizeSearchSource(source) {
  const value = String(source ?? DEFAULT_SEARCH_SOURCE).trim().toLowerCase();
  return SEARCH_SOURCES.has(value) ? value : DEFAULT_SEARCH_SOURCE;
}

function normalizeTtsSettings(settings = {}) {
  return {
    enabled: Boolean(settings.enabled),
    textChannelId: normalizeOptionalId(settings.textChannelId),
    voice: normalizeOptionalString(settings.voice),
    voiceChannelId: normalizeOptionalId(settings.voiceChannelId)
  };
}

function normalizeOptionalId(value) {
  const id = String(value ?? '').trim();
  return /^\d{5,30}$/.test(id) ? id : null;
}

function normalizeOptionalString(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function queueSettingsWrite() {
  writePromise = writePromise.then(writeSettingsFile, writeSettingsFile);
  return writePromise;
}

async function writeSettingsFile() {
  const filePath = settingsPath();
  const tempPath = `${filePath}.tmp`;
  const data = Object.fromEntries([...guildSettings.entries()].sort(([a], [b]) => a.localeCompare(b)));

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`);
  await rename(tempPath, filePath);
}

function settingsPath() {
  return path.resolve(process.env.GUILD_SETTINGS_PATH?.trim() || defaultSettingsPath);
}

function guildSettingsKey(guildId) {
  if (!guildId) {
    throw new Error('guildId is required for guild settings.');
  }

  return String(guildId);
}
