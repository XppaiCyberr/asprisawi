import { SlashCommandBuilder } from 'discord.js';
import { statusMessage } from '../lib/embeds.js';
import { respond } from '../lib/replies.js';

const commandGroups = [
  {
    name: 'Music',
    commands: [
      ['play <query>', 'Search, pick a result, and play or queue it'],
      ['queue', 'Show the current and upcoming tracks'],
      ['nowplaying', 'Show the current track with controls'],
      ['pause', 'Pause or resume playback'],
      ['skip', 'Skip the current track'],
      ['previous', 'Play the previous track when available'],
      ['shuffle', 'Shuffle upcoming tracks'],
      ['stop', 'Stop playback without leaving voice'],
      ['leave', 'Owner-only disconnect from voice']
    ]
  },
  {
    name: 'Settings',
    commands: [
      ['autoplay [enabled]', 'Toggle related tracks when the queue ends'],
      ['loop <mode>', 'Set off, track, queue, or autoplay repeat mode'],
      ['volume <0-100>', 'Set playback volume'],
      ['searchsource [source]', 'Set plain text search to YouTube, Spotify, or auto'],
      ['tts [enabled] [voice]', 'Read chat messages into voice']
    ]
  },
  {
    name: 'Extras',
    commands: [
      ['lyric', 'Show lyrics for the current track'],
      ['rank [limit]', 'Show voice call time rankings'],
      ['sawi <question>', 'Ask Sawi a question'],
      ['status', 'Show bot setup and playback health'],
      ['help', 'Show this command list']
    ]
  }
];

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Show bot commands and quick usage');

export async function execute(interaction) {
  await respond(interaction, statusMessage(
    'Help',
    'Use slash commands, or use the `?` prefix for the same commands when Message Content Intent is enabled. Plain `/play` searches show a picker so you can choose the right track.',
    'info',
    {
      fields: commandGroups.map((group) => ({
        name: group.name,
        value: group.commands
          .map(([usage, description]) => `\`/${usage}\` - ${description}`)
          .join('\n')
      }))
    }
  ));
}
