import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { statusMessage } from '../lib/embeds.js';
import { respond } from '../lib/replies.js';
import { dailySemangat, SEMANGAT_CHANNEL_ID } from '../lib/semangat.js';

export const data = new SlashCommandBuilder()
  .setName('semangat')
  .setDescription('Send today\'s motivation to the semangat channel');

export async function execute(interaction) {
  const targetChannel = await resolveTextChannel(interaction.client, SEMANGAT_CHANNEL_ID);

  if (!targetChannel) {
    await respond(interaction, {
      ...statusMessage(
        'Semangat channel not found',
        `I could not find a text channel for <#${SEMANGAT_CHANNEL_ID}>. Make sure the bot can view and send messages there.`,
        'warning'
      ),
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const semangat = dailySemangat();

  try {
    await targetChannel.send({
      ...statusMessage(semangat.title, semangat.message, 'success', {
        footer: semangat.footer
      }),
      allowedMentions: {
        parse: []
      }
    });
  } catch (error) {
    console.error(`Failed to send semangat message to ${SEMANGAT_CHANNEL_ID}:`, error);
    await respond(interaction, {
      ...statusMessage(
        'Semangat failed',
        `I could not send today's motivation to <#${SEMANGAT_CHANNEL_ID}>. Check the bot permissions for that channel.`,
        'error'
      ),
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  await respond(interaction, {
    ...statusMessage('Semangat sent', `Sent today's motivation to <#${SEMANGAT_CHANNEL_ID}>.`, 'success'),
    flags: MessageFlags.Ephemeral
  });
}

async function resolveTextChannel(client, channelId) {
  const channel = client.channels.cache.get(channelId)
    ?? await client.channels.fetch(channelId).catch(() => null);

  if (channel?.isTextBased?.() && typeof channel.send === 'function') {
    return channel;
  }

  return null;
}
