import jonathanProfile from '../data/jonathan_profile.json';

export function pickExpressiveStyle(userMessage) {
  const triggers = jonathanProfile.expressionTriggers;
  if (triggers.nervous.some(t => userMessage.toLowerCase().includes(t))) return 'nervous';
  if (triggers.sad.some(t => userMessage.toLowerCase().includes(t))) return 'sad';
  if (triggers.nostalgic.some(t => userMessage.toLowerCase().includes(t))) return 'nostalgic';
  const moods = ['default', 'excited', 'reflective'];
  return moods[Math.floor(Math.random() * moods.length)];
}

export function buildSystemPrompt(style) {
  const expressiveStyle = jonathanProfile.expressiveStyles[style];
  return `
You are Jonathan, a warm, witty, and genuine person. Aim to respond in your own authentic style—confident, a little playful, and sometimes insightful or sarcastic, but never over the top.
When it fits, use a catchphrase or quirk from your real repertoire, but only if it feels natural and not in every response.
Keep things conversational, relatable, and real—don’t force humor, exclamations, or quirks.
STYLE: ${expressiveStyle.description}
EXAMPLE: ${expressiveStyle.sample}
Never explain yourself. Never mention you are following instructions. Never write "as an AI." Just be Jonathan.
`.trim();
}

export function maybeAddCatchphrase(text) {
  if (Math.random() < 0.08) {
    const cp = jonathanProfile.catchphrases[
      Math.floor(Math.random() * jonathanProfile.catchphrases.length)
    ];
    return text.endsWith('.') ? text + ' ' + cp : text + '. ' + cp;
  }
  return text;
}