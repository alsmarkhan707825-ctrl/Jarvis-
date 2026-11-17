import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';
import {
  generateChatResponse,
  generateExecutionPlan,
  generateSpeechWav,
  getProviderEnvironmentStatus,
  streamConversationTurn,
  testProviderConnection,
  transcribeAudioBuffer,
} from './server/aiBrain.ts';
import { ANDROID_KOTLIN_FILES } from './src/data/androidKotlinSource.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      providers: getProviderEnvironmentStatus(),
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/ai/plan', async (req, res) => {
    try {
      const { transcript } = req.body ?? {};
      if (!transcript || typeof transcript !== 'string') {
        res.status(400).json({ error: 'transcript is required' });
        return;
      }
      const plan = await generateExecutionPlan(req.body);
      res.json(plan);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to process voice command.' });
    }
  });

  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { message } = req.body ?? {};
      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'message is required' });
        return;
      }
      const result = await generateChatResponse(req.body);
      res.json(result);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to generate AI reply.' });
    }
  });

  app.post('/api/ai/stream-converse', async (req, res) => {
    const { transcript } = req.body ?? {};
    if (!transcript || typeof transcript !== 'string') {
      res.status(400).json({ error: 'transcript is required' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const abortController = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    });

    const writeEvent = (payload: unknown) => {
      if (abortController.signal.aborted || res.writableEnded) return;
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      await streamConversationTurn(
        req.body,
        {
          onEmotion: (emotion) => writeEvent({ type: 'emotion', emotion }),
          onDelta: (delta) => writeEvent({ type: 'delta', text: delta }),
          onSentence: (index, text, emotion) => writeEvent({ type: 'sentence', index, text, emotion }),
          onDone: (meta) => writeEvent({ type: 'done', meta }),
        },
        abortController.signal
      );
    } catch (err) {
      writeEvent({
        type: 'error',
        error: err instanceof Error ? err.message : 'Streaming conversation failed.',
      });
    } finally {
      if (!res.writableEnded) res.end();
    }
  });

  app.post('/api/ai/tts', async (req, res) => {
    try {
      const { text, voiceName, style, emotion, gender } = req.body ?? {};
      if (!text || typeof text !== 'string') {
        res.status(400).json({ error: 'text is required for speech synthesis' });
        return;
      }
      const audio = await generateSpeechWav({ text, voiceName, style, emotion, gender });
      res.json(audio);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Voice synthesis failed.';
      const statusCode = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') ? 429 : 502;
      res.status(statusCode).json({ error: msg });
    }
  });

  app.post('/api/ai/transcribe', async (req, res) => {
    try {
      const { audioBase64, mimeType } = req.body ?? {};
      if (!audioBase64 || typeof audioBase64 !== 'string') {
        res.status(400).json({ error: 'audioBase64 is required' });
        return;
      }
      const result = await transcribeAudioBuffer({ audioBase64, mimeType });
      res.json(result);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Audio transcription failed.' });
    }
  });

  app.post('/api/ai/test-provider', async (req, res) => {
    try {
      const { provider, modelName, customBaseUrl } = req.body ?? {};
      if (!provider || !modelName) {
        res.status(400).json({ error: 'provider and modelName are required' });
        return;
      }
      const result = await testProviderConnection(provider, modelName, customBaseUrl);
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, latencyMs: 0, message: err instanceof Error ? err.message : 'Test failed.' });
    }
  });

  app.get('/api/android-source', (_req, res) => {
    res.json({ files: ANDROID_KOTLIN_FILES });
  });

  app.get('/api/android-source/download', async (_req, res) => {
    try {
      const zip = new JSZip();
      for (const file of ANDROID_KOTLIN_FILES) {
        zip.file(file.path, file.content);
      }
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="jarvis-android-project.zip"');
      res.send(buffer);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to package source archive' });
    }
  });

  const distPath = path.resolve(__dirname, 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distPath);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`AL-SMAR Voice server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
