import { MessageFlags } from 'discord.js';

export function suppressEmbeds(payload) {
  const message = typeof payload === 'string' ? { content: payload } : { ...payload };

  if (message.embeds?.length) {
    return message;
  }

  return {
    ...message,
    flags: mergeMessageFlags(message.flags)
  };
}

export async function respond(interaction, payload) {
  const message = suppressEmbeds(payload);

  if (interaction.deferred || interaction.replied) {
    return interaction.followUp(message);
  }

  return interaction.reply(message);
}

export async function safeRespond(interaction, payload, context = 'interaction response') {
  try {
    await respond(interaction, payload);
    return true;
  } catch (error) {
    console.error(`Failed to send ${context}:`, error);
    return false;
  }
}

function mergeMessageFlags(flags) {
  if (flags === undefined) {
    return MessageFlags.SuppressEmbeds;
  }

  if (typeof flags === 'number') {
    return flags | MessageFlags.SuppressEmbeds;
  }

  if (Array.isArray(flags)) {
    return [...new Set([...flags, MessageFlags.SuppressEmbeds])];
  }

  return [flags, MessageFlags.SuppressEmbeds];
}
