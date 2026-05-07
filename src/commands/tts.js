import { SlashCommandBuilder } from 'discord.js';
import { statusMessage } from '../lib/embeds.js';
import { getTtsSettings, setTtsSettings } from '../lib/guild-settings.js';
import { respond } from '../lib/replies.js';
import { DEFAULT_TTS_VOICE, isAutomaticTtsConfigured, normalizeTtsVoice } from '../lib/tts.js';
import { requirePlayableVoiceChannel } from '../lib/voice.js';

export const data = new SlashCommandBuilder()
  .setName('tts')
  .setDescription('Toggle automatic text-to-speech for this text channel')
  .addBooleanOption((option) =>
    option
      .setName('enabled')
      .setDescription('Turn automatic TTS on or off. Omit to toggle.')
      .setRequired(false)
  )
  .addStringOption((option) =>
    option
      .setName('voice')
      .setDescription(`Edge TTS voice ShortName. Default: ${DEFAULT_TTS_VOICE}`)
      .setRequired(false)
      .setMaxLength(100)
  );

export async function execute(interaction) {
  const current = getTtsSettings(interaction.guildId);
  const requestedEnabled = interaction.options.getBoolean('enabled');
  const enabled = requestedEnabled ?? !current.enabled;

  if (!enabled) {
    await setTtsSettings(interaction.guildId, { enabled: false });
    await respond(interaction, statusMessage('TTS disabled', 'Automatic chat TTS is off for this server.', 'stopped'));
    return;
  }

  if (!isAutomaticTtsConfigured()) {
    await respond(interaction, statusMessage(
      'TTS setup required',
      'Enable **Message Content Intent** in the Discord Developer Portal, set `ENABLE_MESSAGE_CONTENT_INTENT=true` in `.env`, then restart the bot.',
      'warning'
    ));
    return;
  }

  let voice;

  try {
    voice = normalizeTtsVoice(interaction.options.getString('voice') ?? current.voice ?? undefined);
  } catch (error) {
    await respond(interaction, statusMessage('Invalid voice', error.message, 'warning'));
    return;
  }

  const voiceRequirement = await requirePlayableVoiceChannel(interaction);

  if (!voiceRequirement.ok) {
    await respond(interaction, statusMessage('Voice required', voiceRequirement.message, 'warning'));
    return;
  }

  await setTtsSettings(interaction.guildId, {
    enabled: true,
    textChannelId: interaction.channelId,
    voice,
    voiceChannelId: voiceRequirement.voiceChannel.id
  });

  await respond(interaction, statusMessage(
    'TTS enabled',
    `Reading user messages from ${interaction.channel} into ${voiceRequirement.voiceChannel} with \`${voice}\`.`,
    'success'
  ));
}
