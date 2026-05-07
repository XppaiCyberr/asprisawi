import { PermissionFlagsBits } from 'discord.js';

export async function requireVoiceChannel(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const voiceChannel = member.voice.channel;

  if (!voiceChannel) {
    return {
      ok: false,
      message: 'Join a voice channel first.'
    };
  }

  return {
    ok: true,
    member,
    voiceChannel
  };
}

export async function requirePlayableVoiceChannel(interaction) {
  const voice = await requireVoiceChannel(interaction);

  if (!voice.ok) {
    return voice;
  }

  const botMember = interaction.guild.members.me
    ?? await interaction.guild.members.fetchMe();
  const botVoiceChannel = botMember.voice.channel;

  if (botVoiceChannel && botVoiceChannel.id !== voice.voiceChannel.id) {
    return {
      ok: false,
      message: `I am already playing in ${botVoiceChannel}.`
    };
  }

  const permissions = voice.voiceChannel.permissionsFor(botMember);

  if (!permissions?.has(PermissionFlagsBits.Connect)) {
    return {
      ok: false,
      message: `I cannot connect to ${voice.voiceChannel}.`
    };
  }

  if (!permissions.has(PermissionFlagsBits.Speak)) {
    return {
      ok: false,
      message: `I cannot speak in ${voice.voiceChannel}.`
    };
  }

  return voice;
}

export async function requireSameVoiceChannel(interaction, queue) {
  const voice = await requireVoiceChannel(interaction);

  if (!voice.ok) {
    return voice;
  }

  const botMember = interaction.guild.members.me
    ?? await interaction.guild.members.fetchMe();
  const activeVoiceChannel = queue?.channel ?? botMember.voice.channel;

  if (activeVoiceChannel && activeVoiceChannel.id !== voice.voiceChannel.id) {
    return {
      ok: false,
      message: `Join ${activeVoiceChannel} to control playback.`
    };
  }

  return voice;
}
