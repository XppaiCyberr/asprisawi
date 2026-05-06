import { SlashCommandBuilder } from 'discord.js';
import { QueueRepeatMode, useMainPlayer } from 'discord-player';
import { trackMarkdown } from '../lib/format.js';
import { isAutoplayEnabled } from '../lib/guild-settings.js';
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
    await interaction.reply(voice.message);
    return;
  }

  const query = normalizeYouTubeUrl(interaction.options.getString('query', true));
  const player = useMainPlayer();

  await interaction.deferReply();

  try {
    const result = await player.play(voice.voiceChannel, query, {
      requestedBy: interaction.user,
      nodeOptions: {
        metadata: {
          textChannel: interaction.channel,
          requestedBy: interaction.user
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

    await interaction.followUp(`Queued: ${trackMarkdown(result.track)}`);
  } catch (error) {
    console.error('Play command failed:', error);
    await interaction.followUp('Could not play that request. Try a YouTube URL/search, direct audio URL, SoundCloud, Vimeo, or Reverbnation source.');
  }
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
