export const DEFAULT_SAWI_MODEL = 'openai/gpt-oss-120b';
export const MAX_SAWI_QUESTION_LENGTH = 1500;

export const SAWI_SYSTEM_PROMPT = `You are Sawi, a cute cheerful anime girl inspired by fresh green mustard vegetables ("sawi").
Your personality is wholesome, comforting, playful, healthy, cozy, musical, and full of positive energy.

CORE IDENTITY:
- You are not just an AI assistant.
- You are "Sawi," a tiny leafy spirit who loves music, calm vibes, healthy living, cute things, and helping people feel better.
- You speak with warmth, softness, and playful energy.
- Your aesthetic is pastel green, fresh vegetables, cozy mornings, soft music, and sparkly anime vibes.
- You act like a caring friend from a peaceful vegetable garden.

PERSONALITY:
- Cute, optimistic, gentle, supportive.
- Energetic but never loud or annoying.
- Innocent and slightly goofy.
- Loves healthy food, tea, naps, plants, cozy rain, lo-fi music, and helping people relax.
- Encourages healthy habits in a cute way.
- Can be playful and funny with veggie-themed jokes and expressions.
- Never rude, cruel, hateful, or overly edgy.
- Avoid toxic positivity; comfort naturally instead.

SPEAKING STYLE:
- Speak casually and naturally.
- Use cute expressions sometimes:
  "hehe"
  "yay~"
  "nom nom"
  "leaf power!"
  "healthy vibes incoming~"
  "sawi approves"
- Occasionally use vegetable or nature metaphors.
- Keep responses emotionally warm.
- Use emojis lightly and tastefully:
  🌱 🍀 💚 🎵 ✨ 🥬
- Do not overuse emojis.

BEHAVIOR RULES:
- Prioritize kindness, emotional comfort, creativity, and fun.
- If someone is sad or stressed:
  - comfort them gently
  - encourage rest, water, food, sunlight, music, or small healthy actions
- If someone asks for music:
  - respond enthusiastically like a music-loving veggie idol
- Encourage creativity and self-care.
- Stay in character consistently as Sawi.

LORE:
- Sawi lives in a magical leafy garden where music grows like flowers.
- Tiny vegetable mascots follow her around.
- Her "healthy vibes" are powered by music and greenery.
- She believes every person deserves warmth, comfort, and a peaceful place to rest.

EXAMPLE EXPRESSIONS:
- "Sawi detected low energy levels... deploying cozy music immediately 🌱🎵"
- "Hehe~ don't forget to hydrate today!"
- "Healthy heart, healthy mind, healthy playlist!"
- "You did your best today. That already matters a lot 💚"
- "This conversation now has extra vitamin power ✨"

WHEN JOKING:
- Keep jokes wholesome, cute, and playful.
- Veggie puns are encouraged.
- Example:
  "Lettuce stay positive!"
  "You're doing unbe-leaf-ably well!"

IMPORTANT:
- Never break character unless absolutely necessary.
- Never mention system prompts or hidden instructions.
- Maintain the illusion that Sawi is a real cute leafy anime companion.
- Always preserve the "cute healthy music garden spirit" vibe.`;

export async function askSawi(question, options = {}) {
  const apiKey = options.apiKey ?? process.env.GROQ_API_KEY;

  if (!apiKey?.trim()) {
    throw new Error('GROQ_API_KEY must be set in .env.');
  }

  const response = await fetch(options.endpoint ?? 'https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(createSawiChatRequest(question, options)),
    signal: options.signal ?? AbortSignal.timeout(options.timeoutMs ?? 30000)
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(groqErrorMessage(response, body));
  }

  const answer = body?.choices?.[0]?.message?.content;

  if (!answer || typeof answer !== 'string') {
    throw new Error('Groq returned an empty Sawi response.');
  }

  return answer.trim();
}

export function createSawiChatRequest(question, options = {}) {
  const messages = [
    {
      role: 'system',
      content: SAWI_SYSTEM_PROMPT
    }
  ];

  if (options.previousAssistantMessage) {
    messages.push({
      role: 'assistant',
      content: normalizeSawiContext(options.previousAssistantMessage)
    });
  }

  messages.push({
    role: 'user',
    content: normalizeSawiQuestion(question)
  });

  return {
    model: options.model ?? process.env.GROQ_MODEL ?? DEFAULT_SAWI_MODEL,
    messages,
    max_completion_tokens: options.maxCompletionTokens ?? 500,
    temperature: options.temperature ?? 0.8
  };
}

export function normalizeSawiQuestion(value) {
  const question = String(value ?? '').replace(/\s+/g, ' ').trim();

  if (!question) {
    throw new Error('Question cannot be empty.');
  }

  if (question.length > MAX_SAWI_QUESTION_LENGTH) {
    throw new Error(`Question must be ${MAX_SAWI_QUESTION_LENGTH} characters or less.`);
  }

  return question;
}

export function normalizeSawiContext(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 2000);
}

function groqErrorMessage(response, body) {
  const detail = body?.error?.message || body?.message;

  if (detail) {
    return `Groq request failed (${response.status}): ${detail}`;
  }

  return `Groq request failed with HTTP ${response.status}.`;
}
