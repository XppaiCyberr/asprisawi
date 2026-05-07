import { SlashCommandBuilder } from 'discord.js';
import { statusMessage } from '../lib/embeds.js';
import { askSawi, MAX_SAWI_QUESTION_LENGTH, normalizeSawiQuestion } from '../lib/sawi-ai.js';
import { respond } from '../lib/replies.js';

export const data = new SlashCommandBuilder()
  .setName('sawi')
  .setDescription('Ask Sawi a question')
  .addStringOption((option) =>
    option
      .setName('question')
      .setDescription('What do you want to ask Sawi?')
      .setRequired(true)
      .setMaxLength(MAX_SAWI_QUESTION_LENGTH)
  );

export async function execute(interaction) {
  let question;

  try {
    question = normalizeSawiQuestion(interaction.options.getString('question', true));
  } catch (error) {
    await respond(interaction, statusMessage('Invalid question', error.message, 'warning'));
    return;
  }

  await interaction.deferReply();

  try {
    const answer = await askSawi(question);
    await interaction.editReply(statusMessage('Sawi says', answer, 'success'));
  } catch (error) {
    console.error('Sawi command failed:', error);
    await interaction.editReply(statusMessage('Sawi is resting', sawiErrorMessage(error), 'error'));
  }
}

function sawiErrorMessage(error) {
  const message = String(error?.message ?? error);

  if (message.includes('GROQ_API_KEY')) {
    return 'Sawi needs `GROQ_API_KEY` in `.env` before she can answer questions.';
  }

  return 'Sawi could not answer right now. Check the bot logs for details.';
}
