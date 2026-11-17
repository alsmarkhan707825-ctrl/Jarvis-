import { useCallback, useEffect, useRef, useState } from 'react';
import { History, Home, MessageSquare, Settings, Sliders, X } from 'lucide-react';
import {
  DEFAULT_MODELS,
  DEFAULT_VOICE_SETTINGS,
  INITIAL_DEVICE_STATE,
  INITIAL_MEMORIES,
  INITIAL_PERMISSIONS,
} from './data/initialState';
import { applyDeviceStep } from './engine/automationExecutor';
import { sanitizeWithPrivacySandbox } from './utils/privacySandbox';
import { useVoiceEngine } from './hooks/useVoiceEngine';
import { ChatView, HistoryView, SettingsView, VoiceStudioView } from './components/SecondaryViews';
import { VoiceHomeView } from './components/VoiceHomeView';
import type {
  AIModelConfig,
  AIPlanResponse,
  AndroidPermissionItem,
  AndroidSourceFile,
  AssistantState,
  AutomationRunLog,
  ConversationMessage,
  EmotionalState,
  NeuralVoiceId,
  PlannedActionStep,
  ProviderEnvironmentStatus,
  ProviderId,
  RouterMode,
  ScreenId,
  VirtualDeviceState,
  VoiceSettingsConfig,
} from './types/alsmar';

const STORAGE_SETTINGS_KEY = 'alsmar_voice_settings_v3';
const STORAGE_HISTORY_KEY = 'alsmar_history_v3';

function loadSavedSettings(): VoiceSettingsConfig {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
    if (!raw) return DEFAULT_VOICE_SETTINGS;
    return { ...DEFAULT_VOICE_SETTINGS, ...(JSON.parse(raw) as Partial<VoiceSettingsConfig>) };
  } catch {
    return DEFAULT_VOICE_SETTINGS;
  }
}

function loadSavedHistory(): AutomationRunLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AutomationRunLog[]).slice(0, 30) : [];
  } catch {
    return [];
  }
}

interface StreamDoneMeta {
  fullText: string;
  emotion?: EmotionalState;
  detectedLanguage: 'en' | 'hi' | 'hinglish' | 'ur';
  intentSummary: string;
  requiresConfirmation: boolean;
  sensitiveReason?: string;
  steps: PlannedActionStep[];
  providerUsed: ProviderId;
  modelUsed: string;
  latencyMs: number;
  fallbackTriggered: boolean;
}

export function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('home');
  const [assistantState, setAssistantState] = useState<AssistantState>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'OFFLINE' : 'IDLE'
  );
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSubtitle, setLastSubtitle] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const [voiceSettings, setVoiceSettings] = useState<VoiceSettingsConfig>(loadSavedSettings);
  const [models, setModels] = useState<AIModelConfig[]>(DEFAULT_MODELS);
  const [routerMode, setRouterMode] = useState<RouterMode>('smart-auto');
  const [envStatus, setEnvStatus] = useState<ProviderEnvironmentStatus | null>(null);
  const [permissions, setPermissions] = useState<AndroidPermissionItem[]>(INITIAL_PERMISSIONS);
  const [device, setDevice] = useState<VirtualDeviceState>(INITIAL_DEVICE_STATE);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [logs, setLogs] = useState<AutomationRunLog[]>(loadSavedHistory);
  const [androidFiles, setAndroidFiles] = useState<AndroidSourceFile[]>([]);
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    command: string;
    plan: AIPlanResponse;
  } | null>(null);

  const deviceRef = useRef(device);
  deviceRef.current = device;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const modelsRef = useRef(models);
  modelsRef.current = models;
  const routerModeRef = useRef(routerMode);
  routerModeRef.current = routerMode;
  const voiceSettingsRef = useRef(voiceSettings);
  voiceSettingsRef.current = voiceSettings;

  const aiAbortRef = useRef<AbortController | null>(null);
  const lastCommandRef = useRef<string>('');
  const handleCommandRef = useRef<(text: string, speakReply?: boolean) => Promise<void>>(async () => {});

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(voiceSettings));
    } catch {
      // Ignore quota errors
    }
  }, [voiceSettings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(logs.slice(0, 30)));
    } catch {
      // Ignore quota errors
    }
  }, [logs]);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      setAssistantState((prev) => (prev === 'OFFLINE' ? 'IDLE' : prev));
      setErrorMessage(null);
    };
    const onOffline = () => {
      setIsOnline(false);
      setAssistantState('OFFLINE');
      setErrorMessage('Internet connection lost. Reconnect to continue.');
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    fetch('/api/health')
      .then((r) => r.json())
      .then((data: { providers?: ProviderEnvironmentStatus }) => {
        if (data.providers) setEnvStatus(data.providers);
      })
      .catch(() => {});

    fetch('/api/android-source')
      .then((r) => r.json())
      .then((data: { files?: AndroidSourceFile[] }) => {
        if (Array.isArray(data.files)) setAndroidFiles(data.files);
      })
      .catch(() => {});

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      aiAbortRef.current?.abort();
    };
  }, []);

  const voice = useVoiceEngine({
    settings: voiceSettings,
    state: assistantState,
    setState: setAssistantState,
    onError: setErrorMessage,
    onBargeIn: () => {
      aiAbortRef.current?.abort();
      setBusy(false);
    },
    onUserUtterance: async (transcript) => {
      await handleCommandRef.current(transcript, true);
    },
  });

  const runDeviceSteps = useCallback(async (steps: PlannedActionStep[]): Promise<{
    updatedSteps: PlannedActionStep[];
    anyFailed: boolean;
  }> => {
    if (steps.length === 0) return { updatedSteps: [], anyFailed: false };
    setAssistantState('EXECUTING');
    const updatedSteps: PlannedActionStep[] = [];
    let currentDev = deviceRef.current;
    let anyFailed = false;

    for (const step of steps) {
      await new Promise((r) => setTimeout(r, 170));
      const res = applyDeviceStep(currentDev, step);
      currentDev = res.nextState;
      setDevice(currentDev);
      if (!res.ok) anyFailed = true;
      updatedSteps.push({
        ...step,
        status: res.ok ? 'verified' : 'failed',
        errorDetail: res.errorDetail,
      });
    }
    return { updatedSteps, anyFailed };
  }, []);

  const executeVerifiedPlan = useCallback(
    async (command: string, plan: AIPlanResponse, speakReply: boolean) => {
      const { updatedSteps, anyFailed } = await runDeviceSteps(plan.steps);

      const spokenText = (
        plan.isAmbiguous && plan.clarificationQuestion
          ? plan.clarificationQuestion
          : anyFailed
            ? 'One of the requested phone actions could not be completed on the current screen.'
            : plan.spokenResponse
      ).trim();

      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSubtitle(spokenText);

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: spokenText,
          language: plan.detectedLanguage,
          timestamp: nowStr,
          modelUsed: plan.modelUsed,
          latencyMs: plan.latencyMs,
          voiceUsed: voiceSettingsRef.current.neuralVoice,
        },
      ]);

      setLogs((prev) => [
        {
          id: `log-${Date.now()}`,
          command,
          detectedLanguage: plan.detectedLanguage,
          intentSummary: plan.intentSummary,
          status: anyFailed ? 'failed' : 'verified',
          providerUsed: plan.providerUsed,
          modelUsed: plan.modelUsed,
          latencyMs: plan.latencyMs,
          timestamp: nowStr,
          steps: updatedSteps,
          spokenResult: spokenText,
        },
        ...prev.slice(0, 29),
      ]);

      if (speakReply) {
        const ttsResult = await voice.speakText(spokenText, plan.detectedLanguage);
        if (!ttsResult.ok && !ttsResult.interrupted) {
          setErrorMessage(ttsResult.error || 'Voice playback failed.');
          setAssistantState('ERROR');
        }
      } else {
        setAssistantState(voice.conversationActive ? 'LISTENING' : 'IDLE');
      }
    },
    [runDeviceSteps, voice]
  );

  const handleCommand = useCallback(
    async (transcript: string, speakReply = true) => {
      const rawCleaned = transcript.trim();
      if (!rawCleaned) return;

      const sandboxCheck = voiceSettingsRef.current.privacySandboxEnabled
        ? sanitizeWithPrivacySandbox(rawCleaned)
        : { sanitizedText: rawCleaned, blockedCategories: [], hasSensitiveData: false };
      const cleaned = sandboxCheck.sanitizedText;

      lastCommandRef.current = cleaned;
      setErrorMessage(
        sandboxCheck.hasSensitiveData
          ? `Privacy Sandbox redacted sensitive fields (${sandboxCheck.blockedCategories.join(', ')}) before AI processing.`
          : null
      );

      if (!navigator.onLine) {
        setIsOnline(false);
        setAssistantState('OFFLINE');
        const msg = 'You are currently offline. Please check your internet connection and try again.';
        setErrorMessage(msg);
        setLastSubtitle(msg);
        if (speakReply) {
          await voice.speakText(msg, 'en');
        }
        return;
      }

      aiAbortRef.current?.abort();
      const controller = new AbortController();
      aiAbortRef.current = controller;

      setBusy(true);
      setAssistantState('PROCESSING');

      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const userMsgId = `u-${Date.now()}`;
      const assistantMsgId = `a-${Date.now() + 1}`;

      setMessages((prev) => [
        ...prev,
        { id: userMsgId, role: 'user', content: cleaned, timestamp: nowStr },
        {
          id: assistantMsgId,
          role: 'assistant',
          content: '',
          timestamp: nowStr,
          voiceUsed: voiceSettingsRef.current.neuralVoice,
        },
      ]);

      voice.resetLastSpeechBuffer();
      const streamGeneration = speakReply ? voice.beginSpeechStream() : -1;
      let synchronizedSpoken = '';
      let streamedRaw = '';
      let enqueuedCount = 0;

      try {
        const primaryModel = modelsRef.current.find((m) => m.isDefault) || modelsRef.current[0];
        setAssistantState('THINKING');
        const resp = await fetch('/api/ai/stream-converse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            transcript: cleaned,
            languageHint: voiceSettingsRef.current.preferredLanguage,
            privacySandboxEnabled: voiceSettingsRef.current.privacySandboxEnabled,
            deviceContext: deviceRef.current,
            conversationHistory: messagesRef.current.slice(-8),
            approvedMemories: INITIAL_MEMORIES,
            routerMode: routerModeRef.current,
            preferredProvider: primaryModel.provider,
            preferredModel: primaryModel.modelName,
            modelsRegistry: modelsRef.current,
            fallbackChain: modelsRef.current.map((m) => ({
              provider: m.provider,
              modelName: m.modelName,
            })),
          }),
        });

        if (!resp.ok || !resp.body) {
          const errJson = (await resp.json().catch(() => ({}))) as { error?: string };
          throw new Error(errJson.error || 'AI streaming endpoint returned an error.');
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = '';
        let doneMeta: StreamDoneMeta | null = null;
        let resolvedEmotion: EmotionalState = 'normal';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (controller.signal.aborted) break;

          sseBuffer += decoder.decode(value, { stream: true });
          const frames = sseBuffer.split('\n\n');
          sseBuffer = frames.pop() ?? '';

          for (const frame of frames) {
            const line = frame.trim();
            if (!line.startsWith('data:')) continue;
            const jsonStr = line.slice(5).trim();
            if (!jsonStr) continue;

            const evt = JSON.parse(jsonStr) as
              | { type: 'emotion'; emotion: EmotionalState }
              | { type: 'delta'; text: string }
              | { type: 'sentence'; index: number; text: string; emotion?: EmotionalState }
              | { type: 'done'; meta: StreamDoneMeta }
              | { type: 'error'; error: string };

            if (evt.type === 'error') {
              throw new Error(evt.error || 'Streaming AI response failed.');
            }

            if (evt.type === 'emotion') {
              resolvedEmotion = evt.emotion;
              voice.setActiveEmotion(evt.emotion);
            } else if (evt.type === 'delta') {
              streamedRaw += evt.text;
              if (!speakReply) {
                setLastSubtitle(streamedRaw);
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantMsgId ? { ...m, content: streamedRaw } : m))
                );
              }
            } else if (evt.type === 'sentence' && speakReply) {
              enqueuedCount += 1;
              const sentenceEmo = evt.emotion || resolvedEmotion;
              voice.enqueueSpeechChunk(
                streamGeneration,
                evt.text,
                voiceSettingsRef.current.preferredLanguage,
                (spokenChunk) => {
                  // Synchronize displayed caption & message text with active synthesized audio
                  synchronizedSpoken = synchronizedSpoken
                    ? `${synchronizedSpoken} ${spokenChunk}`
                    : spokenChunk;
                  setLastSubtitle(synchronizedSpoken);
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId ? { ...m, content: synchronizedSpoken } : m
                    )
                  );
                },
                sentenceEmo
              );
            } else if (evt.type === 'done') {
              doneMeta = evt.meta;
            }
          }
        }

        if (controller.signal.aborted) return;

        if (!doneMeta) {
          throw new Error('AI response stream closed before completion.');
        }

        const meta = doneMeta;
        const finalEmotion = meta.emotion || resolvedEmotion;
        voice.setActiveEmotion(finalEmotion);

        // If sensitive confirmation needed, pause automation and request user approval
        if (meta.requiresConfirmation) {
          if (speakReply) {
            await voice.finishSpeechStream(streamGeneration, false);
          }
          const planObj: AIPlanResponse = {
            detectedLanguage: meta.detectedLanguage,
            intentSummary: meta.intentSummary,
            classifiedCapability: 'tools',
            routingReason: 'Confirmed automation check',
            isAmbiguous: false,
            requiresConfirmation: true,
            sensitiveReason: meta.sensitiveReason,
            spokenResponse: meta.fullText,
            steps: meta.steps,
            providerUsed: meta.providerUsed,
            modelUsed: meta.modelUsed,
            latencyMs: meta.latencyMs,
            fallbackTriggered: meta.fallbackTriggered,
          };
          setPendingConfirmation({ command: cleaned, plan: planObj });
          return;
        }

        // Fallback enqueue if model produced text without triggering a sentence boundary
        if (speakReply && enqueuedCount === 0 && meta.fullText.trim()) {
          voice.enqueueSpeechChunk(
            streamGeneration,
            meta.fullText.trim(),
            meta.detectedLanguage,
            (chunk) => {
              setLastSubtitle(chunk);
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsgId ? { ...m, content: chunk } : m))
              );
            },
            finalEmotion
          );
        }

        // Execute multi-step phone automation concurrently with or after spoken intro
        let updatedSteps: PlannedActionStep[] = [];
        let anyFailed = false;
        if (meta.steps.length > 0) {
          const execRes = await runDeviceSteps(meta.steps);
          updatedSteps = execRes.updatedSteps;
          anyFailed = execRes.anyFailed;
        }

        if (speakReply) {
          const ttsResult = await voice.finishSpeechStream(streamGeneration, true);
          if (!ttsResult.ok && !ttsResult.interrupted) {
            setErrorMessage(ttsResult.error || 'Voice playback failed.');
            setAssistantState('ERROR');
          }
        } else {
          setAssistantState(voice.conversationActive ? 'LISTENING' : 'IDLE');
        }

        setLastSubtitle(meta.fullText);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: meta.fullText,
                  language: meta.detectedLanguage,
                  emotion: finalEmotion,
                  modelUsed: meta.modelUsed,
                  latencyMs: meta.latencyMs,
                }
              : m
          )
        );

        setLogs((prev) => [
          {
            id: `log-${Date.now()}`,
            command: cleaned,
            detectedLanguage: meta.detectedLanguage,
            intentSummary: meta.intentSummary,
            status: anyFailed ? 'failed' : 'verified',
            providerUsed: meta.providerUsed,
            modelUsed: meta.modelUsed,
            latencyMs: meta.latencyMs,
            timestamp: nowStr,
            steps: updatedSteps,
            spokenResult: meta.fullText,
          },
          ...prev.slice(0, 29),
        ]);
      } catch (err) {
        if (controller.signal.aborted) return;
        voice.stopSpeaking();
        const msg = err instanceof Error ? err.message : 'Unable to complete your request.';
        setErrorMessage(msg);
        setAssistantState('ERROR');
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId || m.content.trim().length > 0));
      } finally {
        setBusy(false);
      }
    },
    [runDeviceSteps, voice]
  );

  handleCommandRef.current = handleCommand;

  const handleTogglePermission = useCallback(
    async (id: string) => {
      const target = permissions.find((p) => p.id === id);
      if (!target) return;

      if (!target.enabled && target.browserTestable === 'microphone' && navigator.mediaDevices?.getUserMedia) {
        try {
          const s = await navigator.mediaDevices.getUserMedia({ audio: true });
          s.getTracks().forEach((t) => t.stop());
        } catch {
          setErrorMessage('Browser blocked microphone access.');
          return;
        }
      } else if (!target.enabled && target.browserTestable === 'camera' && navigator.mediaDevices?.getUserMedia) {
        try {
          const s = await navigator.mediaDevices.getUserMedia({ video: true });
          s.getTracks().forEach((t) => t.stop());
        } catch {
          setErrorMessage('Browser blocked camera access.');
          return;
        }
      } else if (!target.enabled && target.browserTestable === 'notifications' && 'Notification' in window) {
        try {
          await Notification.requestPermission();
        } catch {
          // Ignore blocked notifications prompt
        }
      }

      setPermissions((prev) => prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)));
    },
    [permissions]
  );

  const handlePreviewVoice = useCallback(
    async (voiceId: NeuralVoiceId) => {
      await voice.unlockAudio();
      setVoiceSettings((prev) => ({ ...prev, neuralVoice: voiceId }));
      await voice.speakText(
        `Hello, I am AL-SMAR speaking with the ${voiceId} neural voice. Main aapki kya madad kar sakta hoon?`,
        voiceSettings.preferredLanguage
      );
    },
    [voice, voiceSettings.preferredLanguage]
  );

  const handleTestModel = useCallback(async (model: AIModelConfig) => {
    const resp = await fetch('/api/ai/test-provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: model.provider, modelName: model.modelName }),
    });
    const res = (await resp.json()) as { ok: boolean; latencyMs: number; message: string };
    setModels((prev) =>
      prev.map((m) =>
        m.id === model.id
          ? {
              ...m,
              status: res.ok ? 'ready' : 'unavailable',
              lastLatencyMs: res.latencyMs,
              statusMessage: `${res.message} (${res.latencyMs}ms)`,
            }
          : m
      )
    );
  }, []);

  const navItems: Array<{ id: ScreenId; label: string; icon: typeof Home }> = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'voice', label: 'Voice', icon: Sliders },
    { id: 'history', label: 'History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="royal-canvas relative h-[100dvh] w-full flex flex-col overflow-hidden text-slate-100">
      <div aria-hidden="true" className="jarvis-grid-overlay pointer-events-none absolute inset-0 opacity-45" />
      <main className="relative z-10 flex-1 min-h-0 overflow-hidden">
        {activeScreen === 'home' && (
          <VoiceHomeView
            state={assistantState}
            isOnline={isOnline}
            conversationActive={voice.conversationActive}
            inputLevel={voice.inputLevel}
            outputLevel={voice.outputLevel}
            audioBars={voice.audioBars}
            voiceGender={voiceSettings.preferredGender}
            voiceName={voiceSettings.neuralVoice}
            interimTranscript={voice.interimTranscript}
            lastSubtitle={lastSubtitle}
            errorMessage={errorMessage}
            hasRetryableSpeech={Boolean(lastSubtitle || voice.hasRetryableSpeech)}
            onStartConversation={() => void voice.startConversation()}
            onEndConversation={() => {
              aiAbortRef.current?.abort();
              voice.endConversation();
            }}
            onCommitSpeech={() => voice.commitCurrentSpeech()}
            onInterruptSpeech={() => {
              aiAbortRef.current?.abort();
              voice.stopSpeaking();
              if (voice.conversationActive) {
                void voice.startConversation();
              } else {
                setAssistantState('IDLE');
              }
            }}
            onRetryVoice={() => void voice.retryLastSpeech()}
            onRetryLastCommand={() => {
              if (lastCommandRef.current) {
                void handleCommand(lastCommandRef.current, true);
              }
            }}
            onOpenSettings={() => setActiveScreen('settings')}
          />
        )}

        {activeScreen === 'chat' && (
          <ChatView
            messages={messages}
            busy={busy}
            onSendMessage={async (text) => {
              await voice.unlockAudio();
              await handleCommand(text, true);
            }}
            onSpeakMessage={async (text, lang) => {
              await voice.unlockAudio();
              await voice.speakText(text, lang);
            }}
            onClearMessages={() => setMessages([])}
          />
        )}

        {activeScreen === 'voice' && (
          <VoiceStudioView
            settings={voiceSettings}
            previewBusy={assistantState === 'SPEAKING'}
            onUpdateSettings={(patch) => setVoiceSettings((prev) => ({ ...prev, ...patch }))}
            onPreviewVoice={handlePreviewVoice}
          />
        )}

        {activeScreen === 'history' && (
          <HistoryView
            logs={logs}
            onReplayVoice={async (text, lang) => {
              await voice.unlockAudio();
              await voice.speakText(text, lang);
            }}
            onRerunCommand={async (cmd) => {
              await voice.unlockAudio();
              await handleCommand(cmd, true);
            }}
            onClearHistory={() => setLogs([])}
          />
        )}

        {activeScreen === 'settings' && (
          <SettingsView
            permissions={permissions}
            models={models}
            routerMode={routerMode}
            envStatus={envStatus}
            device={device}
            androidFiles={androidFiles}
            busy={busy}
            onTogglePermission={handleTogglePermission}
            onChangeRouterMode={setRouterMode}
            onTestModel={handleTestModel}
            onRunCommand={async (cmd) => {
              await voice.unlockAudio();
              await handleCommand(cmd, true);
            }}
            onQuickTapApp={(appName) => {
              const res = applyDeviceStep(deviceRef.current, {
                stepNumber: 1,
                actionType: 'LAUNCH_APP',
                targetApp: appName,
                description: `Open ${appName}`,
                verificationCriteria: 'App launched',
              });
              setDevice(res.nextState);
            }}
            onQuickNav={(nav) => {
              const actionType =
                nav === 'back' ? 'NAVIGATE_BACK' : nav === 'home' ? 'NAVIGATE_HOME' : 'OPEN_RECENTS';
              const res = applyDeviceStep(deviceRef.current, {
                stepNumber: 1,
                actionType,
                description: nav,
                verificationCriteria: 'Navigated',
              });
              setDevice(res.nextState);
            }}
          />
        )}
      </main>

      <nav
        aria-label="Primary Navigation"
        className="relative z-20 shrink-0 border-t border-cyan-400/15 bg-[#020612]/95 px-2 py-2"
      >
        <div className="max-w-lg mx-auto grid grid-cols-5 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeScreen === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveScreen(item.id)}
                className={`relative flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl transition-all duration-150 cursor-pointer ${
                  active
                    ? 'text-[#F0C95C] bg-white/[0.04]'
                    : 'text-slate-400 hover:text-cyan-200'
                }`}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-gradient-to-r from-cyan-400 via-[#F0C95C] to-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.7)]"
                  />
                )}
                <Icon className="w-4 h-4" />
                <span className="text-[11px] font-medium whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {pendingConfirmation && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="glass-panel-gold rounded-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-semibold text-white">
                  Confirm Sensitive Action
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  {pendingConfirmation.plan.sensitiveReason || pendingConfirmation.plan.intentSummary}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingConfirmation(null);
                  setAssistantState('IDLE');
                }}
                aria-label="Cancel confirmation"
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setPendingConfirmation(null);
                  setAssistantState('IDLE');
                }}
                className="px-4 py-2 rounded-xl bg-white/10 text-xs font-medium text-white hover:bg-white/15 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const item = pendingConfirmation;
                  setPendingConfirmation(null);
                  void voice.unlockAudio().then(() =>
                    executeVerifiedPlan(item.command, item.plan, true)
                  );
                }}
                className="px-4 py-2 rounded-xl bg-[#D4AF37] text-[#050814] text-xs font-semibold hover:bg-[#F0C95C] cursor-pointer"
              >
                Approve & Execute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
