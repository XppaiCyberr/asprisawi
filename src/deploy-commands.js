import dotenv from 'dotenv';
import { REST, Routes } from 'discord.js';
import { loadCommands } from './lib/command-loader.js';

dotenv.config({ quiet: true });

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  throw new Error('DISCORD_TOKEN and CLIENT_ID must be set in .env.');
}

const commands = await loadCommands();
const body = commands.map((command) => command.data.toJSON());
const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
const clearGlobalCommands = GUILD_ID && process.env.CLEAR_GLOBAL_COMMANDS !== 'false';
const clearGuildIds = parseIds(process.env.CLEAR_GUILD_IDS);

if (GUILD_ID) {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body });
  console.log(`Registered ${body.length} guild commands for ${GUILD_ID}.`);

  if (clearGlobalCommands) {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
    console.log('Cleared global commands to remove stale commands from older deployments.');
  }
} else {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body });
  console.log(`Registered ${body.length} global commands. Global command updates can take up to an hour.`);

  for (const guildId of clearGuildIds) {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), { body: [] });
    console.log(`Cleared guild commands for ${guildId}.`);
  }
}

function parseIds(value) {
  return String(value ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}
