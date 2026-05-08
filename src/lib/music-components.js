import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export const MUSIC_CONTROL_PREFIX = 'music';
export const MUSIC_CONTROL_IDS = {
  previous: `${MUSIC_CONTROL_PREFIX}:previous`,
  pause: `${MUSIC_CONTROL_PREFIX}:pause`,
  skip: `${MUSIC_CONTROL_PREFIX}:skip`,
  stop: `${MUSIC_CONTROL_PREFIX}:stop`
};

export function musicPlayerControls() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(MUSIC_CONTROL_IDS.previous)
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(MUSIC_CONTROL_IDS.pause)
        .setLabel('Pause/Resume')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(MUSIC_CONTROL_IDS.skip)
        .setLabel('Skip')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(MUSIC_CONTROL_IDS.stop)
        .setLabel('Stop')
        .setStyle(ButtonStyle.Danger)
    )
  ];
}
