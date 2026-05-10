import { MessageFlags } from 'discord.js';
import { QueueRepeatMode } from 'discord-player';
import { statusMessage } from './embeds.js';
import { safeRespond } from './replies.js';

export const DEFAULT_COMMAND_PREFIX = '?';

const LOOP_MODES = {
  autoplay: QueueRepeatMode.AUTOPLAY,
  off: QueueRepeatMode.OFF,
  queue: QueueRepeatMode.QUEUE,
  track: QueueRepeatMode.TRACK
};
const BOOLEAN_VALUES = {
  false: false,
  no: false,
  off: false,
  on: true,
  true: true,
  yes: true
};
const PREFIX_USAGE = {
  autoplay: '?autoplay [on|off]',
  clear: '?clear',
  help: '?help',
  loop: '?loop <off|track|queue|autoplay>',
  play: '?play <song, URL, or playlist>',
  rank: '?rank [limit]',
  sawi: '?sawi <question>',
  searchsource: '?searchsource <youtube|spotify|auto>',
  semangat: '?semangat',
  status: '?status',
  tts: '?tts [on|off] [voice]',
  volume: '?volume <0-100>'
};

export function isPrefixCommandMessage(message, prefix = commandPrefix()) {
  return Boolean(prefixCommandName(message, prefix));
}

export async function handlePrefixCommandMessage(message, { commands, isAuthorized, player, prefix = commandPrefix() }) {
  const parsed = parsePrefixCommand(message.content, prefix);

  if (!parsed) {
    return false;
  }

  const command = commands.get(parsed.commandName);

  if (!command) {
    await message.reply(statusMessage(
      'Unknown command',
      `Unknown command: ${prefix}${parsed.commandName}`,
      'warning'
    )).catch((error) => {
      console.error('Failed to send unknown prefix command reply:', error);
    });
    return true;
  }

  if (parsed.commandName !== 'leave' && !isAuthorized(message)) {
    await message.reply(statusMessage('Permission denied', 'You do not have permission to use this bot.', 'error'))
      .catch((error) => {
        console.error('Failed to send prefix permission denied reply:', error);
      });
    return true;
  }

  let interaction;

  try {
    interaction = createPrefixInteraction(message, parsed);
  } catch (error) {
    await message.reply(statusMessage(
      'Command failed',
      prefixUsageMessage(parsed.commandName, error.message),
      'warning'
    )).catch((replyError) => {
      console.error('Failed to send prefix usage reply:', replyError);
    });
    return true;
  }

  try {
    await player.context.provide({ guild: message.guild }, () => command.execute(interaction));
  } catch (error) {
    console.error(`Prefix command ${parsed.commandName} failed:`, error);
    await safeRespond(
      interaction,
      statusMessage('Command failed', 'That command failed. Check the bot logs for details.', 'error'),
      `${parsed.commandName} prefix error response`
    );
  }

  return true;
}

export function parsePrefixCommand(content, prefix = commandPrefix()) {
  const text = String(content ?? '');

  if (!prefix || !text.startsWith(prefix)) {
    return null;
  }

  const withoutPrefix = text.slice(prefix.length).trim();

  if (!withoutPrefix) {
    return null;
  }

  const match = /^(\S+)(?:\s+([\s\S]*))?$/.exec(withoutPrefix);

  if (!match) {
    return null;
  }

  return {
    args: match[2]?.trim() ?? '',
    commandName: match[1].toLowerCase(),
    prefix
  };
}

export function createPrefixInteraction(message, parsed) {
  let deferredMessage = null;
  const values = prefixOptionValues(parsed.commandName, parsed.args);
  const interaction = {
    channel: message.channel,
    channelId: message.channelId,
    client: message.client,
    commandName: parsed.commandName,
    deferred: false,
    guild: message.guild,
    guildId: message.guildId,
    member: message.member,
    memberPermissions: message.member?.permissions,
    replied: false,
    user: message.author,
    inGuild: () => Boolean(message.guildId),
    options: {
      getBoolean: (name, required = false) => optionValue(values, name, required),
      getInteger: (name, required = false) => optionValue(values, name, required),
      getNumber: (name, required = false) => optionValue(values, name, required),
      getString: (name, required = false) => optionValue(values, name, required)
    },
    deferReply: async () => {
      interaction.deferred = true;
      deferredMessage = await message.reply(statusMessage('Working', 'Processing command...', 'info'));
      return deferredMessage;
    },
    editReply: async (payload) => {
      if (!deferredMessage) {
        return interaction.reply(payload);
      }

      deferredMessage = await deferredMessage.edit(prefixMessagePayload(payload));
      interaction.replied = true;
      return deferredMessage;
    },
    followUp: async (payload) => message.reply(prefixMessagePayload(payload)),
    reply: async (payload) => {
      interaction.replied = true;
      return message.reply(prefixMessagePayload(payload));
    }
  };

  return interaction;
}

function prefixCommandName(message, prefix) {
  if (!message.guildId || message.author?.bot || message.webhookId || message.system) {
    return null;
  }

  return parsePrefixCommand(message.content, prefix)?.commandName ?? null;
}

function commandPrefix() {
  return process.env.COMMAND_PREFIX || DEFAULT_COMMAND_PREFIX;
}

function prefixOptionValues(commandName, rawArgs) {
  const firstArg = firstToken(rawArgs);

  switch (commandName) {
    case 'autoplay':
      return {
        enabled: firstArg ? parseBoolean(firstArg, 'enabled') : null
      };
    case 'loop':
      return {
        mode: parseLoopMode(firstArg)
      };
    case 'play':
      return {
        query: requiredText(rawArgs, 'query')
      };
    case 'rank':
      return {
        limit: firstArg ? parseRankLimit(firstArg) : null
      };
    case 'sawi':
      return {
        question: requiredText(rawArgs, 'question')
      };
    case 'searchsource':
      return {
        source: firstArg || null
      };
    case 'tts':
      return ttsOptions(rawArgs);
    case 'volume':
      return {
        level: parseVolume(firstArg)
      };
    default:
      return {};
  }
}

function optionValue(values, name, required) {
  const value = values[name] ?? null;

  if (required && value === null) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function firstToken(value) {
  return String(value ?? '').trim().split(/\s+/).filter(Boolean).at(0) ?? '';
}

function requiredText(value, name) {
  const text = String(value ?? '').trim();

  if (!text) {
    throw new Error(`${name} is required.`);
  }

  return text;
}

function parseBoolean(value, name) {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized in BOOLEAN_VALUES) {
    return BOOLEAN_VALUES[normalized];
  }

  throw new Error(`${name} must be on or off.`);
}

function parseLoopMode(value) {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized in LOOP_MODES) {
    return LOOP_MODES[normalized];
  }

  throw new Error('mode must be off, track, queue, or autoplay.');
}

function parseVolume(value) {
  const volume = Number.parseInt(value, 10);

  if (!Number.isInteger(volume) || volume < 0 || volume > 100) {
    throw new Error('level must be a number from 0 to 100.');
  }

  return volume;
}

function parseRankLimit(value) {
  const limit = Number.parseInt(value, 10);

  if (!Number.isInteger(limit) || limit < 1 || limit > 25) {
    throw new Error('limit must be a number from 1 to 25.');
  }

  return limit;
}

function ttsOptions(rawArgs) {
  const tokens = String(rawArgs ?? '').trim().split(/\s+/).filter(Boolean);

  if (!tokens.length) {
    return {
      enabled: null,
      voice: null
    };
  }

  try {
    return {
      enabled: parseBoolean(tokens[0], 'enabled'),
      voice: tokens[1] ?? null
    };
  } catch {
    return {
      enabled: null,
      voice: tokens[0]
    };
  }
}

function prefixUsageMessage(commandName, errorMessage) {
  const usage = PREFIX_USAGE[commandName];

  if (!usage) {
    return errorMessage;
  }

  return `${errorMessage}\nUsage: \`${usage}\``;
}

function prefixMessagePayload(payload) {
  const message = typeof payload === 'string'
    ? { content: payload }
    : { ...payload };

  if (message.flags === undefined) {
    return message;
  }

  if (typeof message.flags === 'number') {
    message.flags &= ~MessageFlags.Ephemeral;

    if (message.flags === 0) {
      delete message.flags;
    }

    return message;
  }

  if (Array.isArray(message.flags)) {
    message.flags = message.flags.filter((flag) => flag !== MessageFlags.Ephemeral && flag !== 'Ephemeral');

    if (message.flags.length === 0) {
      delete message.flags;
    }
  }

  return message;
}
