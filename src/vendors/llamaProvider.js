let llama;

export async function loadLlamaProvider({ modelPath }) {
  try {
    // lazy import optional dependency
    const mod = await import('node-llama-cpp');
    llama = mod;
  } catch (e) {
    console.warn('node-llama-cpp not installed, skipping local GGUF provider');
    return null;
  }

  const { LlamaModel, LlamaContext, LlamaChatSession } = llama;
  let session;
  try {
    const model = new LlamaModel({
      modelPath,
      // reasonable defaults for 8B Q4_K_M on CPU; adjust as needed
      gpuLayers: 0,
    });
    const context = new LlamaContext({ model, contextSize: 4096 });
    session = new LlamaChatSession({ context });
  } catch (e) {
    console.warn('Failed to initialize local GGUF provider, falling back:', e?.message || e);
    return null;
  }

  return {
    name: 'llama.cpp',
    async complete(messages) {
      const prompt = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
      const response = await session.prompt(prompt, {
        temperature: 0.6,
        topP: 0.9,
        maxTokens: 512,
        repeatPenalty: 1.1,
      });
      return response;
    },
  };
}


