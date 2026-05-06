export async function respond(interaction, payload) {
  const message = typeof payload === 'string' ? { content: payload } : payload;

  if (interaction.deferred || interaction.replied) {
    return interaction.followUp(message);
  }

  return interaction.reply(message);
}
