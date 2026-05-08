import { suppressEmbeds } from './replies.js';

export function createPlaybackStatus(interaction) {
  let message = null;
  let state = 'pending';

  return {
    get state() {
      return state;
    },
    async update(payload, nextState = state) {
      state = nextState;

      try {
        const body = suppressEmbeds(payload);

        if (message) {
          message = await message.edit(body);
        } else {
          message = await interaction.editReply(body);
        }

        return message;
      } catch (error) {
        console.error('Failed to update playback status message:', error);
        return null;
      }
    }
  };
}
