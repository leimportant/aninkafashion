import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createChatService } from './services/chatService.js';
import cookieParser from 'cookie-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const PORT = process.env.PORT ? Number(process.env.PORT) : 3300;
const PUBLIC_API = process.env.PUBLIC_API || 'http://localhost:8000';

const chatService = await createChatService({
  llamaModelPath: process.env.LLAMA_MODEL_PATH,
  groqApiKey: process.env.GROQ_API_KEY,
  groqModel: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
  publicApiBaseUrl: PUBLIC_API,
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, authCookie } = req.body || {};
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages must be an array' });
    }
    const reply = await chatService.generateReply(messages, req.headers, authCookie, req.cookies || {});
    return res.json(reply);
  } catch (error) {
    console.error('Chat error', error);
    return res.status(200).json({ provider: 'none', message: 'Ups, saya tidak memiliki informasi tersebut saat ini.', products: [] });
  }
});

// serve static UI
app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, () => {
  console.log(`Chat server listening on http://localhost:${PORT}`);
});


