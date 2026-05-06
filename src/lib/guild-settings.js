const guildSettings = new Map();

export function getGuildSettings(guildId) {
  if (!guildSettings.has(guildId)) {
    guildSettings.set(guildId, {
      autoplay: false
    });
  }

  return guildSettings.get(guildId);
}

export function isAutoplayEnabled(guildId) {
  return getGuildSettings(guildId).autoplay;
}

export function setAutoplayEnabled(guildId, enabled) {
  const settings = getGuildSettings(guildId);
  settings.autoplay = enabled;
  return settings.autoplay;
}
