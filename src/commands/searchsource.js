import { SlashCommandBuilder } from 'discord.js';
import { statusMessage } from '../lib/embeds.js';
import { getDefaultSearchSource, setDefaultSearchSource } from '../lib/guild-settings.js';
import { respond } from '../lib/replies.js';

const sourceNames = {
  auto: 'automatic',
  spotify: 'Spotify',
  youtube: 'YouTube'
};

export const data = new SlashCommandBuilder()
  .setName('searchsource')
  .setDescription('Set the default source for plain /play searches')
  .addStringOption((option) =>
    option
      .setName('source')
      .setDescription('Source for plain text searches. Leave empty to show the current source.')
      .addChoices(
        { name: 'Spotify', value: 'spotify' },
        { name: 'YouTube', value: 'youtube' },
        { name: 'Automatic', value: 'auto' }
      )
  );

export async function execute(interaction) {
  const requestedSource = interaction.options.getString('source');
  const source = requestedSource
    ? await setDefaultSearchSource(interaction.guildId, requestedSource)
    : getDefaultSearchSource(interaction.guildId);
  const title = requestedSource ? 'Search source updated' : 'Search source';

  await respond(interaction, statusMessage(
    title,
    `Plain \`/play\` searches use ${sourceNames[source] ?? source}. URLs still use their detected source.`,
    'info'
  ));
}
