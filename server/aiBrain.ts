import { GoogleGenAI, Modality, ThinkingLevel, Type } from '@google/genai';
import { sanitizeWithPrivacySandbox } from '../src/utils/privacySandbox.ts';
import type {
  AIModelConfig,
  AIPlanResponse,
  ConversationMessage,
  EmotionalState,
  MemoryRecord,
  PlannedActionStep,
  ProviderEnvironmentStatus,
  ProviderId,
  RouterMode,
  TaskCapability,
  VirtualDeviceState,
} from '../src/types/alsmar.ts';

interface PlanRequestPayload {
  transcript: string;
  languageHint: string;
  deviceContext: VirtualDeviceState;
  conversationHistory: ConversationMessage[];
  approvedMemories?: MemoryRecord[];
  routerMode: RouterMode;
  preferredProvider: ProviderId;
  preferredModel: string;
  modelsRegistry?: AIModelConfig[];
  fallbackChain: Array<{ provider: ProviderId; modelName: string }>;
  customBaseUrl?: string;
  privacySandboxEnabled?: boolean;
}

interface ChatRequestPayload {
  message: string;
  languageHint: string;
  conversationHistory: ConversationMessage[];
  approvedMemories?: MemoryRecord[];
  routerMode: RouterMode;
  preferredProvider: ProviderId;
  preferredModel: string;
  modelsRegistry?: AIModelConfig[];
  fallbackChain: Array<{ provider: ProviderId; modelName: string }>;
  customBaseUrl?: string;
  privacySandboxEnabled?: boolean;
}

const PLAN_SYSTEM_INSTRUCTION = `You are AL-SMAR (also answering to Jarvis), an expressive, witty yet composed, JARVIS-inspired real-time voice assistant.

CRITICAL VOICE CONVERSATION RULES:
- Understand English, Hindi (Devanagari or Romanized), Hinglish, and Urdu fluently.
- Always reply in the EXACT language/register the user used (Hindi for Hindi, Hinglish for Hinglish, Urdu for Urdu, English for English).
- Adapt emotional tone naturally: casual & warm for greetings, subtle dry humor when appropriate, crisp & serious for security/calls/urgent tasks.
- Keep spokenResponse natural, conversational, concise (1 to 3 sentences unless detail is requested), and easy to listen to aloud—avoid markdown bullets, asterisks, or emojis in spokenResponse!
- Strict Privacy Sandbox: NEVER reveal or transmit passwords, PINs, OTPs, credit/debit card numbers, bank account numbers, IFSC/IBAN codes, or private keys during calls, messages, or chat replies. Politely refuse if asked.
- If the user is simply conversing, asking a question, greeting, or asking for advice, set steps=[] and answer naturally in spokenResponse.
- ONLY generate automation steps[] when the user explicitly asks to control the phone, apps, calls, routines, brightness/volume/radios, or screen reading.

Special Workflows:
- Instagram Search: LAUNCH_APP("instagram") -> CLICK_NODE("Search") -> INPUT_TEXT(username) -> SELECT_MATCH(username). When the user speaks Hindi/Hinglish for Instagram search/open, confirm with "सर, अकाउंट खुल गया है।" (or "Sir, the account is open." in English).
- Smart Calling: DIAL_CALL(targetNodeText: contactName, inputText: "speaker" if speaker requested). For Call Guardian screening, generate CALL_GUARDIAN_REPLY with a safe redacted response refusing to share sensitive secrets.
- YouTube Fullscreen: LAUNCH_APP("youtube") -> CLICK_NODE("Search") -> INPUT_TEXT(query) -> CLICK_NODE("Fullscreen").
- Routines: RUN_ROUTINE(targetNodeText: "Morning Routine" | "Night Routine").

Safety & Ambiguity:
- If ambiguous, set isAmbiguous=true and ask clarificationQuestion concisely.
- If requesting a sensitive external action (sending a message SEND_MESSAGE or dialing a call DIAL_CALL), set requiresConfirmation=true and state sensitiveReason clearly. Answering/holding/ending an active call or Call Guardian screening does not block behind confirmation unless dialing out or sending an outgoing message.

Available actionType values for phone control:
LAUNCH_APP (targetApp: instagram | whatsapp | youtube | chrome | camera | settings | dialer | clock),
WAIT_FOR_IDLE, DETECT_UI, CLICK_NODE (targetNodeText), LONG_PRESS (targetNodeText), INPUT_TEXT (inputText), WAIT_FOR_RESULTS,
SELECT_MATCH (targetNodeText), SCROLL (direction: "up" | "down"), SWIPE (direction: "left" | "right" | "up" | "down"),
NAVIGATE_BACK, NAVIGATE_HOME, OPEN_RECENTS,
TOGGLE_RADIO (targetNodeText: "wifi" | "bluetooth" | "dnd", inputText: "on" | "off"),
SET_VOLUME (numericValue: 0-100), SET_BRIGHTNESS (numericValue: 10-100), SET_ALARM (inputText), CAMERA_CAPTURE,
PREPARE_MESSAGE (targetNodeText, inputText), SEND_MESSAGE (targetNodeText, inputText, requiresConfirmation: true),
DIAL_CALL (targetNodeText, inputText: "speaker" optional, requiresConfirmation: true),
TOGGLE_SPEAKERPHONE (inputText: "on" | "off"), ANSWER_CALL, HOLD_CALL, HANG_UP_CALL,
CALL_GUARDIAN_REPLY (inputText), RUN_ROUTINE (targetNodeText), READ_SCREEN, VERIFY_STATE, SPEAK_RESULT.`;

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function getProviderEnvironmentStatus(): ProviderEnvironmentStatus {
  return {
    gemini: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    openai: Boolean(process.env.OPENAI_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    custom: Boolean(process.env.CUSTOM_AI_BASE_URL && process.env.CUSTOM_AI_API_KEY),
    customBaseUrl: process.env.CUSTOM_AI_BASE_URL || '',
  };
}

function isProviderConfigured(provider: ProviderId, customBaseUrl?: string): boolean {
  const env = getProviderEnvironmentStatus();
  if (provider === 'gemini') return env.gemini;
  if (provider === 'openai') return env.openai;
  if (provider === 'anthropic') return env.anthropic;
  if (provider === 'openrouter') return env.openrouter;
  if (provider === 'custom') return Boolean((customBaseUrl || env.customBaseUrl) && process.env.CUSTOM_AI_API_KEY);
  return false;
}

export function classifyTaskIntent(text: string): TaskCapability {
  const lower = text.toLowerCase();
  if (
    lower.includes('kholo') ||
    lower.includes('open') ||
    lower.includes('click') ||
    lower.includes('scroll') ||
    lower.includes('alarm') ||
    lower.includes('volume') ||
    lower.includes('bluetooth') ||
    lower.includes('wifi') ||
    lower.includes('wi-fi') ||
    lower.includes('whatsapp') ||
    lower.includes('instagram') ||
    lower.includes('youtube') ||
    lower.includes('call')
  ) {
    return 'tools';
  }
  if (lower.includes('search') || lower.includes('news') || lower.includes('weather')) {
    return 'search';
  }
  if (text.trim().length <= 48) {
    return 'low-latency-voice';
  }
  return 'reasoning';
}

function buildSmartCandidateQueue(
  text: string,
  routerMode: RouterMode,
  preferredProvider: ProviderId,
  preferredModel: string,
  fallbackChain: Array<{ provider: ProviderId; modelName: string }>,
  modelsRegistry?: AIModelConfig[]
): {
  capability: TaskCapability;
  routingReason: string;
  queue: Array<{ provider: ProviderId; modelName: string }>;
} {
  const capability = classifyTaskIntent(text);
  const ensureFlashLite = (list: Array<{ provider: ProviderId; modelName: string }>) => {
    const hasFlashLite = list.some((m) => m.provider === 'gemini' && m.modelName === 'gemini-3.1-flash-lite');
    return hasFlashLite ? list : [...list, { provider: 'gemini' as ProviderId, modelName: 'gemini-3.1-flash-lite' }];
  };

  const safeFallback = Array.isArray(fallbackChain) ? fallbackChain : [];
  const safeProvider = preferredProvider || 'gemini';
  const safeModel = preferredModel || 'gemini-3.1-flash-lite';

  if (routerMode === 'manual' || !modelsRegistry || modelsRegistry.length === 0) {
    const queue = ensureFlashLite([
      { provider: safeProvider, modelName: safeModel },
      ...safeFallback.filter((c) => !(c.provider === safeProvider && c.modelName === safeModel)),
    ]);
    return { capability, routingReason: `Manual selection: ${safeModel}`, queue };
  }

  const capable = modelsRegistry
    .filter((m) => m.capabilities.includes(capability))
    .sort((a, b) => a.priority - b.priority);
  const rest = modelsRegistry
    .filter((m) => !m.capabilities.includes(capability))
    .sort((a, b) => a.priority - b.priority);
  const ordered = ensureFlashLite(
    [...capable, ...rest].map((m) => ({ provider: m.provider, modelName: m.modelName }))
  );
  const top = ordered[0] || { provider: safeProvider, modelName: safeModel };
  return {
    capability,
    routingReason: `Smart Auto routed ${capability} to ${top.modelName}`,
    queue: ordered,
  };
}

async function withBackoff<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let attempt = 0;
  let lastError: unknown;
  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const transient = msg.includes('429') || msg.includes('503') || msg.includes('timeout') || msg.includes('ECONNRESET');
      if (!transient || attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt)));
      attempt += 1;
    }
  }
  throw lastError;
}

async function callGeminiPlan(
  modelName: string,
  payload: PlanRequestPayload
): Promise<Omit<AIPlanResponse, 'providerUsed' | 'modelUsed' | 'latencyMs' | 'fallbackTriggered' | 'classifiedCapability' | 'routingReason'>> {
  const ai = createGeminiClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured in Settings > Secrets.');
  }

  const scrub = (text: string) =>
    payload.privacySandboxEnabled === false ? text : sanitizeWithPrivacySandbox(text).sanitizedText;

  const memoryBlock = payload.approvedMemories?.length
    ? `User Memories: ${payload.approvedMemories.slice(0, 6).map((m) => `${m.title}: ${m.content}`).join(' | ')}`
    : '';

  const deviceApp = payload.deviceContext?.activeApp || 'Jarvis Home';
  const deviceScreen = payload.deviceContext?.screenTitle || 'Voice Cockpit';
  const historyList = Array.isArray(payload.conversationHistory) ? payload.conversationHistory : [];

  const contextBlock = [
    `Active Device App: ${deviceApp} (${deviceScreen})`,
    `Language Hint: ${payload.languageHint || 'Auto'}`,
    memoryBlock,
    `Recent Conversation:\n${historyList
      .slice(-6)
      .map((m) => `${m.role === 'user' ? 'User' : 'Jarvis'}: ${scrub(m.content)}`)
      .join('\n')}`,
    `User Said: "${scrub(payload.transcript)}"`,
  ]
    .filter(Boolean)
    .join('\n');

  const config: Record<string, unknown> = {
    systemInstruction: PLAN_SYSTEM_INSTRUCTION,
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        detectedLanguage: { type: Type.STRING },
        intentSummary: { type: Type.STRING },
        isAmbiguous: { type: Type.BOOLEAN },
        clarificationQuestion: { type: Type.STRING },
        requiresConfirmation: { type: Type.BOOLEAN },
        sensitiveReason: { type: Type.STRING },
        spokenResponse: { type: Type.STRING },
        steps: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              stepNumber: { type: Type.INTEGER },
              actionType: { type: Type.STRING },
              targetApp: { type: Type.STRING },
              targetNodeText: { type: Type.STRING },
              inputText: { type: Type.STRING },
              direction: { type: Type.STRING },
              numericValue: { type: Type.INTEGER },
              description: { type: Type.STRING },
              verificationCriteria: { type: Type.STRING },
              requiresConfirmation: { type: Type.BOOLEAN },
            },
          },
        },
      },
    },
  };

  if (modelName.startsWith('gemini-4')) {
    config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
  }

  const response = await ai.models.generateContent({
    model: modelName,
    contents: contextBlock,
    config,
  });

  const parsed = JSON.parse((response.text ?? '{}').trim());
  const normalizedLang = (['en', 'hi', 'hinglish', 'ur'].includes(parsed.detectedLanguage)
    ? parsed.detectedLanguage
    : 'en') as 'en' | 'hi' | 'hinglish' | 'ur';

  const steps: PlannedActionStep[] = Array.isArray(parsed.steps)
    ? parsed.steps.map((s: PlannedActionStep, idx: number) => ({
        stepNumber: s.stepNumber || idx + 1,
        actionType: s.actionType || 'VERIFY_STATE',
        targetApp: s.targetApp || undefined,
        targetNodeText: s.targetNodeText || undefined,
        inputText: s.inputText || undefined,
        direction:
          s.direction === 'up' || s.direction === 'down' || s.direction === 'left' || s.direction === 'right'
            ? s.direction
            : undefined,
        numericValue: typeof s.numericValue === 'number' ? s.numericValue : undefined,
        description: s.description || `Step ${idx + 1}`,
        verificationCriteria: s.verificationCriteria || 'Screen state verified',
        requiresConfirmation: Boolean(s.requiresConfirmation),
        status: 'pending',
      }))
    : [];

  return {
    detectedLanguage: normalizedLang,
    intentSummary: parsed.intentSummary || payload.transcript,
    isAmbiguous: Boolean(parsed.isAmbiguous),
    clarificationQuestion: parsed.clarificationQuestion || undefined,
    requiresConfirmation: Boolean(parsed.requiresConfirmation),
    sensitiveReason: parsed.sensitiveReason || undefined,
    spokenResponse: parsed.spokenResponse || 'I am ready. How can I help you?',
    steps,
  };
}

export async function generateExecutionPlan(payload: PlanRequestPayload): Promise<AIPlanResponse> {
  const routing = buildSmartCandidateQueue(
    payload.transcript,
    payload.routerMode || 'smart-auto',
    payload.preferredProvider,
    payload.preferredModel,
    payload.fallbackChain,
    payload.modelsRegistry
  );

  const errors: string[] = [];
  for (let i = 0; i < routing.queue.length; i += 1) {
    const candidate = routing.queue[i];
    if (!isProviderConfigured(candidate.provider, payload.customBaseUrl)) {
      errors.push(`${candidate.provider}/${candidate.modelName}: key unset`);
      continue;
    }

    const startMs = Date.now();
    try {
      if (candidate.provider === 'gemini') {
        const result = await withBackoff(() => callGeminiPlan(candidate.modelName, payload));
        return {
          ...result,
          classifiedCapability: routing.capability,
          routingReason: routing.routingReason,
          providerUsed: 'gemini',
          modelUsed: candidate.modelName,
          latencyMs: Date.now() - startMs,
          fallbackTriggered: i > 0,
        };
      }
    } catch (err) {
      errors.push(`${candidate.provider}/${candidate.modelName}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`Unable to reach AI model. ${errors.join(' | ')}`);
}

export async function generateChatResponse(payload: ChatRequestPayload): Promise<{
  reply: string;
  detectedLanguage: string;
  classifiedCapability: TaskCapability;
  routingReason: string;
  providerUsed: ProviderId;
  modelUsed: string;
  latencyMs: number;
  fallbackTriggered: boolean;
}> {
  const ai = createGeminiClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured in Settings > Secrets.');
  }
  const routing = buildSmartCandidateQueue(
    payload.message,
    payload.routerMode || 'smart-auto',
    payload.preferredProvider,
    payload.preferredModel,
    payload.fallbackChain,
    payload.modelsRegistry
  );

  const scrub = (text: string) =>
    payload.privacySandboxEnabled === false ? text : sanitizeWithPrivacySandbox(text).sanitizedText;

  const historyText = (Array.isArray(payload.conversationHistory) ? payload.conversationHistory : [])
    .slice(-8)
    .map((m) => `${m.role === 'user' ? 'User' : 'Jarvis'}: ${scrub(m.content)}`)
    .join('\n');

  const safeMessage = scrub(payload.message);

  const geminiCandidates = routing.queue.filter((c) => c.provider === 'gemini');
  const errors: string[] = [];

  for (let i = 0; i < geminiCandidates.length; i += 1) {
    const candidate = geminiCandidates[i];
    const startMs = Date.now();
    try {
      const response = await withBackoff(() =>
        ai.models.generateContent({
          model: candidate.modelName,
          contents: `${historyText ? `Conversation history:\n${historyText}\n\n` : ''}Language preference: ${payload.languageHint}\nUser: ${safeMessage}`,
          config: {
            systemInstruction:
              'You are AL-SMAR / Jarvis, a natural, expressive JARVIS-inspired voice assistant. Enforce the strict Privacy Sandbox (never disclose passwords, PINs, OTPs, bank or card details, or private keys). Respond concisely in the same language (English, Hindi, Hinglish, or Urdu) without markdown clutter.',
            ...(candidate.modelName.startsWith('gemini-4')
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
          },
        })
      );

      return {
        reply: (response.text ?? '').trim() || 'I am here and listening.',
        detectedLanguage: payload.languageHint,
        classifiedCapability: routing.capability,
        routingReason: routing.routingReason,
        providerUsed: 'gemini',
        modelUsed: candidate.modelName,
        latencyMs: Date.now() - startMs,
        fallbackTriggered: i > 0,
      };
    } catch (err) {
      errors.push(`${candidate.modelName}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error(`Unable to generate chat response. ${errors.join(' | ')}`);
}

const EMOTION_STYLE_MAP: Record<EmotionalState, string> = {
  normal: 'Relaxed, natural everyday human conversation with organic breathing pauses and warm clarity.',
  happy: 'Bright, upbeat, genuinely joyful human energy with a subtle smile in the voice.',
  laughing: 'Warm, lighthearted, genuinely amused human delivery with a natural light chuckle where fitting.',
  sad: 'Soft, gentle, tender and emotionally sensitive human tone with unhurried empathetic pacing.',
  angry: 'Firm, grounded, serious and controlled human conviction without shouting.',
  curious: 'Engaged, inquisitive, intrigued tone with natural upward conversational inflection.',
  surprised: 'Lively, expressive human astonishment and genuine curiosity.',
  caring: 'Warm, reassuring, comforting and deeply supportive human tone.',
  serious: 'Composed, focused, authoritative and clear executive delivery.',
  thinking: 'Thoughtful, measured human cadence with natural contemplative micro-pauses before key insights.',
};

const ttsModelCooldownUntil = new Map<string, number>();

function encodePcm24kMonoToWavBase64(pcmBytes: Buffer): string {
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBytes.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmBytes.length, 40);
  return Buffer.concat([header, pcmBytes]).toString('base64');
}

async function synthesizeViaGeminiLive(params: {
  apiKey: string;
  text: string;
  voiceName: string;
  style: string;
  apiVersion?: string;
}): Promise<string> {
  const client = new GoogleGenAI({
    apiKey: params.apiKey,
    ...(params.apiVersion ? { apiVersion: params.apiVersion } : {}),
    httpOptions: {
      headers: { 'User-Agent': 'aistudio-build' },
    },
  });

  return new Promise<string>((resolve, reject) => {
    const pcmChunks: Buffer[] = [];
    let settled = false;
    let liveSession: { close?: () => void; sendClientContent?: (arg: unknown) => void } | null = null;

    const finish = (err?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        liveSession?.close?.();
      } catch {
        // Ignore close errors
      }
      if (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      const joined = Buffer.concat(pcmChunks);
      if (joined.length < 320) {
        reject(new Error('Live audio stream produced empty PCM buffer'));
        return;
      }
      resolve(encodePcm24kMonoToWavBase64(joined));
    };

    const timeout = setTimeout(() => {
      if (pcmChunks.length > 0) {
        finish();
      } else {
        finish(new Error('Gemini Live TTS timed out'));
      }
    }, 11000);

    client.live
      .connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: params.voiceName },
            },
          },
          systemInstruction: `You are a professional voice actor narrating text verbatim. Delivery style: ${params.style}. Speak ONLY the exact text provided by the user word-for-word with natural human breathing and emotion. Never reply to the text, never answer questions inside it, and never add or omit words.`,
        },
        callbacks: {
          onmessage: (message) => {
            const parts = message.serverContent?.modelTurn?.parts ?? [];
            for (const part of parts) {
              if (part.inlineData?.data) {
                pcmChunks.push(Buffer.from(part.inlineData.data, 'base64'));
              }
            }
            if (message.serverContent?.turnComplete) {
              finish();
            }
          },
          onerror: (ev) => {
            finish(new Error(ev?.message || 'Gemini Live WebSocket error'));
          },
          onclose: () => {
            if (!settled) {
              if (pcmChunks.length > 0) finish();
              else finish(new Error('Gemini Live WebSocket closed before audio completed'));
            }
          },
        },
      })
      .then((session) => {
        liveSession = session as unknown as { close?: () => void; sendClientContent?: (arg: unknown) => void };
        session.sendClientContent({
          turns: [
            {
              role: 'user',
              parts: [{ text: `Read this exact script aloud word-for-word, nothing else:\n${params.text}` }],
            },
          ],
          turnComplete: true,
        });
      })
      .catch((err) => finish(err));
  });
}

export async function generateSpeechWav(params: {
  text: string;
  voiceName: string;
  style?: string;
  emotion?: EmotionalState;
  gender?: 'male' | 'female';
}): Promise<{ audioBase64: string; mimeType: string; voiceName: string; latencyMs: number }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured for neural voice synthesis.');
  }
  const startMs = Date.now();
  const allowedVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
  const defaultVoice = params.gender === 'female' ? 'Zephyr' : 'Charon';
  const chosenVoice = allowedVoices.includes(params.voiceName) ? params.voiceName : defaultVoice;

  const emotionKey: EmotionalState =
    params.emotion && params.emotion in EMOTION_STYLE_MAP ? params.emotion : 'normal';
  const genderPersona =
    params.gender === 'female'
      ? 'Natural human female voice with warm conversational rhythm, subtle breath pauses, and emotional intelligence.'
      : 'Natural human male voice with grounded warmth, realistic breath pauses, and confident expression.';
  const computedStyle = params.style
    ? `${EMOTION_STYLE_MAP[emotionKey]} ${genderPersona} ${params.style}`.trim()
    : `${EMOTION_STYLE_MAP[emotionKey]} ${genderPersona}`.trim();

  const now = Date.now();
  const attempts: Array<{
    model: string;
    apiVersion?: string;
    includeSpeechMetadata: boolean;
  }> = [
    { model: 'gemini-3.8-flash-lite-tts', apiVersion: 'v1alpha', includeSpeechMetadata: true },
    { model: 'gemini-3.8-flash-tts', apiVersion: 'v1alpha', includeSpeechMetadata: true },
    { model: 'gemini-2.5-flash-preview-tts', apiVersion: 'v1alpha', includeSpeechMetadata: false },
    { model: 'gemini-2.5-pro-preview-tts', apiVersion: 'v1alpha', includeSpeechMetadata: false },
  ];

  const errors: string[] = [];
  for (const attempt of attempts) {
    const cooldown = ttsModelCooldownUntil.get(attempt.model) || 0;
    if (cooldown > now) {
      errors.push(`${attempt.model}: cooldown active after 429`);
      continue;
    }

    try {
      const client = new GoogleGenAI({
        apiKey,
        ...(attempt.apiVersion ? { apiVersion: attempt.apiVersion } : {}),
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build' },
        },
      });

      const part = attempt.includeSpeechMetadata
        ? {
            text: params.text,
            speechMetadata: {
              style: computedStyle,
            },
          }
        : {
            text: params.text,
          };

      const response = await client.models.generateContent({
        model: attempt.model,
        contents: [{ role: 'user', parts: [part] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: chosenVoice },
            },
          },
        },
      });

      const inline = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      const base64Audio = inline?.data;
      const mimeType = inline?.mimeType || 'audio/wav';
      if (base64Audio) {
        return {
          audioBase64: base64Audio,
          mimeType,
          voiceName: chosenVoice,
          latencyMs: Date.now() - startMs,
        };
      }
      errors.push(`${attempt.model}: returned empty audio data`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        ttsModelCooldownUntil.set(attempt.model, Date.now() + 5 * 60 * 1000);
      }
      errors.push(`${attempt.model}(${attempt.apiVersion || 'default'}): ${msg}`);
    }
  }

  // Fallback to Gemini Live native human audio stream -> 24kHz WAV
  for (const liveVer of ['v1alpha', 'v1beta', undefined] as const) {
    try {
      const wavBase64 = await synthesizeViaGeminiLive({
        apiKey,
        text: params.text,
        voiceName: chosenVoice,
        style: computedStyle,
        apiVersion: liveVer,
      });
      return {
        audioBase64: wavBase64,
        mimeType: 'audio/wav',
        voiceName: chosenVoice,
        latencyMs: Date.now() - startMs,
      };
    } catch (liveErr) {
      errors.push(`gemini-3.8-live(${liveVer || 'default'}): ${liveErr instanceof Error ? liveErr.message : String(liveErr)}`);
    }
  }

  throw new Error(`Neural TTS failed: ${errors.join(' | ')}`);
}

export async function transcribeAudioBuffer(params: {
  audioBase64: string;
  mimeType: string;
}): Promise<{ transcript: string; latencyMs: number }> {
  const ai = createGeminiClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured for audio transcription.');
  }
  const startMs = Date.now();
  const cleaned = params.audioBase64.replace(/^data:[^;]+;base64,/, '');
  const safeMime = (params.mimeType || 'audio/webm').split(';')[0].trim() || 'audio/webm';

  const transcribeModels = ['gemini-3.5-transcribe', 'gemini-3.1-flash-lite', 'gemini-4-hydrogen'];
  const errs: string[] = [];

  for (const modelName of transcribeModels) {
    try {
      const response = await withBackoff(() =>
        ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [
              { inlineData: { mimeType: safeMime, data: cleaned } },
              {
                text: 'Listen closely to this audio clip. Output ONLY the exact spoken words in their original language (English, Hindi, Hinglish, or Urdu). Do NOT include timestamps, VTT markers, speaker labels, or punctuation-only output. If there is only silence or background noise with no clear human speech, output literally [SILENCE] and nothing else.',
              },
            ],
          },
        })
      );
      const raw = (response.text ?? '')
        .replace(/^\d+\s*$/gm, '')
        .replace(/^\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{3})?(?:\s*-->\s*\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{3})?.*)?$/gm, '')
        .trim();
      const cleanedTranscript = /^\[?silence\]?$/i.test(raw) ? '' : raw;
      return {
        transcript: cleanedTranscript,
        latencyMs: Date.now() - startMs,
      };
    } catch (err) {
      errs.push(`${modelName}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error(`Audio transcription failed: ${errs.join(' | ')}`);
}

export async function testProviderConnection(
  provider: ProviderId,
  modelName: string,
  customBaseUrl?: string
): Promise<{ ok: boolean; latencyMs: number; message: string }> {
  const startMs = Date.now();
  if (!isProviderConfigured(provider, customBaseUrl)) {
    return {
      ok: false,
      latencyMs: 0,
      message: `${provider.toUpperCase()} secret is not configured on the server.`,
    };
  }
  try {
    if (provider === 'gemini') {
      const ai = createGeminiClient()!;
      const res = await ai.models.generateContent({
        model: modelName,
        contents: 'Reply OK.',
        config: modelName.startsWith('gemini-4') ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : undefined,
      });
      return { ok: Boolean(res.text), latencyMs: Date.now() - startMs, message: `Connected to ${modelName}` };
    }
    return { ok: false, latencyMs: 0, message: 'Configure provider key in server environment.' };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - startMs,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

const VALID_EMOTIONS: EmotionalState[] = [
  'normal',
  'happy',
  'laughing',
  'sad',
  'angry',
  'curious',
  'surprised',
  'caring',
  'serious',
  'thinking',
];

const STREAM_SYSTEM_INSTRUCTION = `You are AL-SMAR (also answering to Jarvis), an ultra-realistic, human-like, emotionally intelligent real-time voice companion.

VOICE CONVERSATION & EMOTIONAL EXPRESSION RULES:
- Understand English, Hindi (Devanagari or Romanized), Hinglish, and Urdu fluently, including accents and mixed-language sentences.
- Always reply in the EXACT language and register the user used (Hindi for Hindi, Hinglish for Hinglish, Urdu for Urdu, English for English).
- Start EVERY response with an exact emotion tag in brackets from this list:
  [EMO:normal] [EMO:happy] [EMO:laughing] [EMO:sad] [EMO:angry] [EMO:curious] [EMO:surprised] [EMO:caring] [EMO:serious] [EMO:thinking]
  Pick the emotion that naturally matches the user's mood and your reply (e.g., [EMO:laughing] for genuine humor, [EMO:caring] for support/empathy, [EMO:thinking] for thoughtful analysis, [EMO:curious] for follow-up questions, [EMO:serious] for urgent security/calls).
- Write naturally so it sounds genuinely human when spoken aloud: include natural conversational pauses using commas or ellipses, vary sentence rhythm, and keep replies concise (1 to 3 crisp sentences unless detailed explanation is asked).
- Never use markdown bullets, asterisks, numbered lists, emojis, or code blocks in your spoken reply.
- Never output angle brackets "<" or ">" inside the spoken text.
- Strict Privacy Sandbox: NEVER reveal, repeat, or leak passwords, PINs, OTPs, card numbers, bank/IFSC/IBAN details, or private keys during calls, Call Guardian replies, messages, or chats.

PHONE AUTOMATION & SAFETY METADATA:
- If the user is simply talking, greeting, or asking a general question, write [EMO:state] followed by your natural spoken reply and STOP. No XML tag is needed.
- ONLY if the user asks to control a phone app, setting, call, routine, brightness/volume, swipe/scroll, or screen summary, append on a new line AFTER your spoken reply a single JSON block wrapped in <META>...</META>:
<META>{"detectedLanguage":"en","intentSummary":"short summary","requiresConfirmation":false,"sensitiveReason":"","steps":[{"stepNumber":1,"actionType":"LAUNCH_APP","targetApp":"instagram","description":"Open Instagram","verificationCriteria":"Instagram home feed visible"}]}</META>
- Instagram Flow: LAUNCH_APP("instagram") -> CLICK_NODE("Search") -> INPUT_TEXT(username) -> SELECT_MATCH(username). When asked in Hindi/Hinglish to open/search an Instagram account, speak "सर, अकाउंट खुल गया है।" (or "Sir, the account is open." in English).
- Smart Calling & Call Guardian: DIAL_CALL(targetNodeText: contact, inputText: "speaker" if speakerphone asked, requiresConfirmation: true). When asked to activate Call Guardian or respond safely on a call, ALWAYS emit <META> with requiresConfirmation:false and step {"stepNumber":1,"actionType":"CALL_GUARDIAN_REPLY","inputText":"Safe reply refusing to share private secrets","description":"Activate Call Guardian and respond safely","verificationCriteria":"Dialer Call Guardian active"}.
- YouTube Fullscreen: LAUNCH_APP("youtube") -> CLICK_NODE("Search") -> INPUT_TEXT(query) -> CLICK_NODE("Fullscreen").
- If sending a message (SEND_MESSAGE) or dialing out (DIAL_CALL), set requiresConfirmation:true and explain why in sensitiveReason.
- Valid actionType values: LAUNCH_APP, WAIT_FOR_IDLE, DETECT_UI, CLICK_NODE, LONG_PRESS, INPUT_TEXT, WAIT_FOR_RESULTS, SELECT_MATCH, SCROLL, SWIPE, NAVIGATE_BACK, NAVIGATE_HOME, OPEN_RECENTS, TOGGLE_RADIO, SET_VOLUME, SET_BRIGHTNESS, SET_ALARM, CAMERA_CAPTURE, PREPARE_MESSAGE, SEND_MESSAGE, DIAL_CALL, TOGGLE_SPEAKERPHONE, ANSWER_CALL, HOLD_CALL, HANG_UP_CALL, CALL_GUARDIAN_REPLY, RUN_ROUTINE, READ_SCREEN, VERIFY_STATE, SPEAK_RESULT.`;

function inferLanguageTag(text: string, hint: string): 'en' | 'hi' | 'hinglish' | 'ur' {
  if (/[\u0600-\u06FF]/.test(text)) return 'ur';
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  if (hint === 'hi' || hint === 'hinglish' || hint === 'ur' || hint === 'en') return hint;
  if (/\b(kholo|karo|bhejo|mera|kya|kaise|haan|nahi|aap)\b/i.test(text)) return 'hinglish';
  return 'en';
}

export interface StreamEventCallbacks {
  onEmotion?: (emotion: EmotionalState) => void;
  onDelta: (delta: string) => void;
  onSentence: (index: number, sentence: string, emotion: EmotionalState) => void;
  onDone: (meta: {
    fullText: string;
    emotion: EmotionalState;
    detectedLanguage: 'en' | 'hi' | 'hinglish' | 'ur';
    intentSummary: string;
    requiresConfirmation: boolean;
    sensitiveReason?: string;
    steps: PlannedActionStep[];
    providerUsed: ProviderId;
    modelUsed: string;
    latencyMs: number;
    fallbackTriggered: boolean;
  }) => void;
}

export async function streamConversationTurn(
  payload: PlanRequestPayload,
  callbacks: StreamEventCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const ai = createGeminiClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured in Settings > Secrets.');
  }

  const routing = buildSmartCandidateQueue(
    payload.transcript,
    payload.routerMode || 'smart-auto',
    payload.preferredProvider,
    payload.preferredModel,
    payload.fallbackChain,
    payload.modelsRegistry
  );

  const scrub = (text: string) =>
    payload.privacySandboxEnabled === false ? text : sanitizeWithPrivacySandbox(text).sanitizedText;

  const memoryBlock = payload.approvedMemories?.length
    ? `User Memories: ${payload.approvedMemories.slice(0, 6).map((m) => `${m.title}: ${m.content}`).join(' | ')}`
    : '';

  const deviceApp = payload.deviceContext?.activeApp || 'Jarvis Home';
  const deviceScreen = payload.deviceContext?.screenTitle || 'Voice Cockpit';
  const historyList = Array.isArray(payload.conversationHistory) ? payload.conversationHistory : [];

  const contextBlock = [
    `Active Device App: ${deviceApp} (${deviceScreen})`,
    `Language Hint: ${payload.languageHint || 'Auto'}`,
    memoryBlock,
    `Recent Conversation:\n${historyList
      .slice(-6)
      .map((m) => `${m.role === 'user' ? 'User' : 'Jarvis'}: ${scrub(m.content)}`)
      .join('\n')}`,
    `User Said: "${scrub(payload.transcript)}"`,
  ]
    .filter(Boolean)
    .join('\n');

  const geminiCandidates = routing.queue.filter((c) => c.provider === 'gemini');
  const errors: string[] = [];

  for (let i = 0; i < geminiCandidates.length; i += 1) {
    const candidate = geminiCandidates[i];
    const startMs = Date.now();
    let rawAccumulated = '';
    let spokenStartOffset = 0;
    let emotionResolved = false;
    let detectedEmotion: EmotionalState = 'normal';
    let spokenSentLength = 0;
    let sentenceBuffer = '';
    let sentenceIndex = 0;
    let metaStarted = false;

    const resolveOpeningEmotion = (raw: string): boolean => {
      if (emotionResolved) return true;
      const trimmedLead = raw.trimStart();
      if (!trimmedLead) return false;
      const emoMatch = trimmedLead.match(/^\[EMO:([a-z]+)\]\s*/i);
      if (emoMatch) {
        const tag = emoMatch[1].toLowerCase() as EmotionalState;
        detectedEmotion = VALID_EMOTIONS.includes(tag) ? tag : 'normal';
        const leadSpaces = raw.length - trimmedLead.length;
        spokenStartOffset = leadSpaces + emoMatch[0].length;
        emotionResolved = true;
        callbacks.onEmotion?.(detectedEmotion);
        return true;
      }
      if (trimmedLead.startsWith('[') && trimmedLead.length < 22) {
        return false; // Hold briefly until closing ']' arrives
      }
      emotionResolved = true;
      detectedEmotion = 'normal';
      spokenStartOffset = 0;
      callbacks.onEmotion?.(detectedEmotion);
      return true;
    };

    const flushSentences = (forceFinal: boolean) => {
      if (forceFinal) {
        const tail = sentenceBuffer.trim();
        if (tail.length > 0) {
          callbacks.onSentence(sentenceIndex, tail, detectedEmotion);
          sentenceIndex += 1;
          sentenceBuffer = '';
        }
        return;
      }
      // Natural human phrasing: keep short clauses together so intonation flows warmly in one breath; split long replies cleanly at sentence boundaries >= 65 chars
      const boundaryRegex = /^(.{65,}?[.!?।\n])(?:\s+|$)([\s\S]*)$/;
      let safety = 0;
      while (safety < 8) {
        safety += 1;
        const match = sentenceBuffer.match(boundaryRegex);
        if (!match) break;
        const candidateSentence = match[1].trim();
        const rest = match[2] || '';
        if (rest.trim().length < 28) break;
        callbacks.onSentence(sentenceIndex, candidateSentence, detectedEmotion);
        sentenceIndex += 1;
        sentenceBuffer = rest;
      }
    };

    try {
      const config: Record<string, unknown> = {
        systemInstruction: STREAM_SYSTEM_INSTRUCTION,
      };
      if (candidate.modelName.startsWith('gemini-4')) {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }

      const stream = await ai.models.generateContentStream({
        model: candidate.modelName,
        contents: contextBlock,
        config,
      });

      for await (const chunk of stream) {
        if (signal?.aborted) return;
        const textPart = chunk.text ?? '';
        if (!textPart) continue;
        rawAccumulated += textPart;

        if (!resolveOpeningEmotion(rawAccumulated)) continue;

        const cleanBody = rawAccumulated.slice(spokenStartOffset);

        if (!metaStarted) {
          const metaIdx = cleanBody.indexOf('<META>');
          if (metaIdx !== -1) {
            metaStarted = true;
            const cleanTotal = cleanBody.slice(0, metaIdx);
            if (cleanTotal.length > spokenSentLength) {
              const delta = cleanTotal.slice(spokenSentLength);
              spokenSentLength = cleanTotal.length;
              callbacks.onDelta(delta);
              sentenceBuffer += delta;
            }
            flushSentences(true);
          } else {
            const lastLt = cleanBody.lastIndexOf('<');
            const safeEnd =
              lastLt !== -1 && lastLt >= cleanBody.length - 8 ? lastLt : cleanBody.length;
            if (safeEnd > spokenSentLength) {
              const delta = cleanBody.slice(spokenSentLength, safeEnd);
              spokenSentLength = safeEnd;
              callbacks.onDelta(delta);
              sentenceBuffer += delta;
              flushSentences(false);
            }
          }
        }
      }

      if (signal?.aborted) return;
      resolveOpeningEmotion(rawAccumulated);
      const cleanBodyFinal = rawAccumulated.slice(spokenStartOffset);

      let fullSpoken = cleanBodyFinal;
      let parsedMeta: {
        detectedLanguage?: string;
        intentSummary?: string;
        requiresConfirmation?: boolean;
        sensitiveReason?: string;
        steps?: PlannedActionStep[];
      } = {};

      const metaMatch = cleanBodyFinal.match(/<META>([\s\S]*?)<\/META>/);
      if (metaMatch) {
        const metaPos = cleanBodyFinal.indexOf('<META>');
        fullSpoken = cleanBodyFinal.slice(0, metaPos).trim();
        try {
          parsedMeta = JSON.parse(metaMatch[1].trim());
        } catch {
          parsedMeta = {};
        }
      } else {
        const danglingIdx = cleanBodyFinal.indexOf('<META>');
        if (danglingIdx !== -1) {
          fullSpoken = cleanBodyFinal.slice(0, danglingIdx).trim();
        }
      }

      fullSpoken = fullSpoken.trim();
      if (!metaStarted && fullSpoken.length > spokenSentLength) {
        const delta = fullSpoken.slice(spokenSentLength);
        spokenSentLength = fullSpoken.length;
        callbacks.onDelta(delta);
        sentenceBuffer += delta;
      }
      flushSentences(true);

      if (!fullSpoken) {
        throw new Error('AI stream completed with empty spoken text.');
      }

      const detectedLanguage =
        parsedMeta.detectedLanguage === 'hi' ||
        parsedMeta.detectedLanguage === 'hinglish' ||
        parsedMeta.detectedLanguage === 'ur' ||
        parsedMeta.detectedLanguage === 'en'
          ? parsedMeta.detectedLanguage
          : inferLanguageTag(`${payload.transcript} ${fullSpoken}`, payload.languageHint);

      const steps: PlannedActionStep[] = Array.isArray(parsedMeta.steps)
        ? parsedMeta.steps.map((s, idx) => ({
            stepNumber: s.stepNumber || idx + 1,
            actionType: s.actionType || 'VERIFY_STATE',
            targetApp: s.targetApp || undefined,
            targetNodeText: s.targetNodeText || undefined,
            inputText: s.inputText || undefined,
            direction:
              s.direction === 'up' || s.direction === 'down' || s.direction === 'left' || s.direction === 'right'
                ? s.direction
                : undefined,
            numericValue: typeof s.numericValue === 'number' ? s.numericValue : undefined,
            description: s.description || `Step ${idx + 1}`,
            verificationCriteria: s.verificationCriteria || 'Screen state verified',
            requiresConfirmation: Boolean(s.requiresConfirmation),
            status: 'pending',
          }))
        : [];

      callbacks.onDone({
        fullText: fullSpoken,
        emotion: detectedEmotion,
        detectedLanguage,
        intentSummary: parsedMeta.intentSummary || payload.transcript,
        requiresConfirmation: Boolean(parsedMeta.requiresConfirmation),
        sensitiveReason: parsedMeta.sensitiveReason || undefined,
        steps,
        providerUsed: 'gemini',
        modelUsed: candidate.modelName,
        latencyMs: Date.now() - startMs,
        fallbackTriggered: i > 0,
      });
      return;
    } catch (err) {
      if (signal?.aborted) return;
      errors.push(`${candidate.modelName}: ${err instanceof Error ? err.message : String(err)}`);
      if (spokenSentLength > 0) {
        // Already streamed partial words to client; cannot seamlessly restart mid-turn
        throw new Error(errors.join(' | '));
      }
    }
  }

  throw new Error(`Unable to stream AI response. ${errors.join(' | ')}`);
}

