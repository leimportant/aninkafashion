import Groq from 'groq-sdk';

export async function loadGroqProvider({ apiKey, model }) {
  if (!apiKey) return null;
  const client = new Groq({ apiKey });
  const usedModel = model || 'llama-3.1-8b-instant';
  return {
    name: 'groq',
    async complete(messages) {
      try {
        const res = await client.chat.completions.create({
          model: usedModel,
          messages,
          temperature: 0.6,
          max_tokens: 512,
        });
        const content = res?.choices?.[0]?.message?.content || '';
        return content;
      } catch (e) {
        console.error('[groq] completion error', e);
        throw e;
      }
    },
  };
}


