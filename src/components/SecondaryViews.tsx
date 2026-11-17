import { useState } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  Cpu,
  Download,
  FileCode2,
  History,
  MessageSquare,
  Play,
  RotateCcw,
  Send,
  ShieldCheck,
  Sliders,
  Smartphone,
  Trash2,
  Volume2,
  XCircle,
} from 'lucide-react';
import { NEURAL_VOICE_OPTIONS } from '../data/initialState';
import type {
  AIModelConfig,
  AndroidPermissionItem,
  AndroidSourceFile,
  AutomationRunLog,
  ConversationMessage,
  NeuralVoiceId,
  ProviderEnvironmentStatus,
  RouterMode,
  SupportedLanguage,
  VirtualDeviceState,
  VoiceSettingsConfig,
} from '../types/alsmar';
import { VirtualPhonePanel } from './VirtualPhonePanel';

interface ChatViewProps {
  messages: ConversationMessage[];
  busy: boolean;
  onSendMessage: (text: string) => Promise<void>;
  onSpeakMessage: (text: string, lang?: string) => Promise<void>;
  onClearMessages: () => void;
}

export function ChatView({
  messages,
  busy,
  onSendMessage,
  onSpeakMessage,
  onClearMessages,
}: ChatViewProps) {
  const [draft, setDraft] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = draft.trim();
    if (!cleaned || busy) return;
    setDraft('');
    await onSendMessage(cleaned);
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto px-4 pt-4 pb-2">
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div>
          <h2 className="font-display text-lg font-semibold text-white">Conversation</h2>
          <p className="text-xs text-slate-400">
            Multilingual text & spoken replies in English, Hindi, Hinglish, and Urdu
          </p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={onClearMessages}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
            <MessageSquare className="w-8 h-8 text-[#D4AF37]/70 mb-3" />
            <p className="text-sm text-slate-200 font-medium">No messages yet</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Type a question or command below, or switch to Home to speak hands-free with the AL-SMAR Orb.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#17368F]/70 border border-cyan-400/25 text-white shadow-[0_0_20px_rgba(37,99,235,0.18)]'
                    : 'glass-panel-gold text-slate-100'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <div className="mt-2 flex items-center justify-between gap-4 text-[11px] text-slate-400">
                  <span>
                    {msg.timestamp}
                    {msg.modelUsed ? ` · ${msg.modelUsed}` : ''}
                    {msg.latencyMs ? ` · ${msg.latencyMs}ms` : ''}
                  </span>
                  {msg.role === 'assistant' && (
                    <button
                      type="button"
                      onClick={() => void onSpeakMessage(msg.content, msg.language)}
                      className="inline-flex items-center gap-1 text-[#F0C95C] hover:underline cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      Speak
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="pt-2 flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message AL-SMAR in English, Hindi, Hinglish, or Urdu..."
          className="flex-1 h-12 px-4 rounded-xl bg-[#070E24] border border-white/15 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#D4AF37]"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          aria-label="Send message"
          className="h-12 px-5 rounded-xl bg-[#D4AF37] text-[#050814] font-semibold text-sm inline-flex items-center gap-2 hover:bg-[#F0C95C] disabled:opacity-45 cursor-pointer"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">{busy ? 'Thinking' : 'Send'}</span>
        </button>
      </form>
    </div>
  );
}

interface VoiceStudioViewProps {
  settings: VoiceSettingsConfig;
  previewBusy: boolean;
  onUpdateSettings: (patch: Partial<VoiceSettingsConfig>) => void;
  onPreviewVoice: (voiceId: NeuralVoiceId) => Promise<void>;
}

const LANGUAGE_OPTIONS: Array<{ id: SupportedLanguage; label: string; desc: string }> = [
  { id: 'auto', label: 'Auto Detect', desc: 'Adapts dynamically' },
  { id: 'en', label: 'English', desc: 'en-US / en-IN' },
  { id: 'hi', label: 'Hindi', desc: 'hi-IN Devanagari' },
  { id: 'hinglish', label: 'Hinglish', desc: 'Bilingual conversational' },
  { id: 'ur', label: 'Urdu', desc: 'ur-PK natural flow' },
];

export function VoiceStudioView({
  settings,
  previewBusy,
  onUpdateSettings,
  onPreviewVoice,
}: VoiceStudioViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="h-full overflow-y-auto max-w-3xl mx-auto px-4 pt-4 pb-6 space-y-6"
    >
      <div className="border-b border-cyan-400/15 pb-3">
        <h2 className="font-display text-lg font-semibold text-white">Human Voice & Language Engine</h2>
        <p className="text-xs text-slate-400">
          Real male & female human voices with automatic contextual tone adaptation in the background
        </p>
      </div>

      {/* Quick Male / Female Human Personality Toggle */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          {
            gender: 'male' as const,
            defaultVoice: 'Charon' as NeuralVoiceId,
            title: 'Human Male Voice',
            desc: 'Warm, confident, expressive delivery with natural breathing pauses.',
          },
          {
            gender: 'female' as const,
            defaultVoice: 'Zephyr' as NeuralVoiceId,
            title: 'Human Female Voice',
            desc: 'Soft, emotionally intelligent, natural conversational cadence.',
          },
        ].map((p) => {
          const active = settings.preferredGender === p.gender;
          return (
            <button
              key={p.gender}
              type="button"
              onClick={() => {
                onUpdateSettings({ preferredGender: p.gender, neuralVoice: p.defaultVoice });
              }}
              className={`rounded-2xl p-4 text-left transition-colors cursor-pointer ${
                active ? 'glass-panel-gold' : 'glass-panel hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white">{p.title}</p>
                <span className={`text-xs font-mono ${active ? 'text-[#F0C95C]' : 'text-slate-500'}`}>
                  {active ? 'ACTIVE' : 'SELECT'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{p.desc}</p>
            </button>
          );
        })}
      </section>

      {/* Neural Voice Selection */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Natural Neural Voices</h3>
          <span className="text-xs text-[#F0C95C] font-mono">
            Active: {settings.preferredGender.toUpperCase()} · {settings.neuralVoice}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {NEURAL_VOICE_OPTIONS.map((v) => {
            const active = settings.neuralVoice === v.id;
            return (
              <div
                key={v.id}
                className={`rounded-xl p-3.5 transition-colors ${
                  active ? 'glass-panel-gold' : 'glass-panel hover:border-white/20'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({
                        neuralVoice: v.id,
                        preferredGender: v.gender,
                      })
                    }
                    className="text-left flex-1 cursor-pointer"
                  >
                    <p className="text-sm font-semibold text-white">{v.label}</p>
                    <p className="text-xs text-slate-400 mt-1">{v.tone}</p>
                  </button>
                  <button
                    type="button"
                    disabled={previewBusy}
                    onClick={() => {
                      onUpdateSettings({
                        neuralVoice: v.id,
                        preferredGender: v.gender,
                      });
                      void onPreviewVoice(v.id);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-[#D4AF37] hover:text-[#050814] text-xs font-medium text-white inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  >
                    <Play className="w-3 h-3" />
                    Preview
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Language Selection */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-white">Recognition & Reply Language</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {LANGUAGE_OPTIONS.map((lang) => {
            const active = settings.preferredLanguage === lang.id;
            return (
              <button
                key={lang.id}
                type="button"
                onClick={() => onUpdateSettings({ preferredLanguage: lang.id })}
                className={`p-3 rounded-xl text-left transition-colors cursor-pointer ${
                  active ? 'glass-panel-gold text-white' : 'glass-panel text-slate-300 hover:text-white'
                }`}
              >
                <p className="text-xs font-semibold">{lang.label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{lang.desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Acoustic & Turn-Taking Tuning */}
      <section className="glass-panel rounded-2xl p-4 space-y-5">
        <h3 className="text-sm font-semibold text-white">Conversation Controls</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <label className="space-y-2 block">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Speaking Speed</span>
              <span className="font-mono text-[#F0C95C]">{settings.speechRate.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.8"
              max="1.4"
              step="0.05"
              value={settings.speechRate}
              onChange={(e) => onUpdateSettings({ speechRate: parseFloat(e.target.value) })}
              className="w-full accent-[#D4AF37]"
            />
          </label>

          <label className="space-y-2 block">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">End-of-Speech Silence</span>
              <span className="font-mono text-[#F0C95C]">{settings.vadSilenceMs} ms</span>
            </div>
            <input
              type="range"
              min="800"
              max="2500"
              step="100"
              value={settings.vadSilenceMs}
              onChange={(e) => onUpdateSettings({ vadSilenceMs: parseInt(e.target.value, 10) })}
              className="w-full accent-[#D4AF37]"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {[
            {
              key: 'strictTurnTaking' as const,
              title: 'Strict Turn-Taking State Machine',
              desc: 'Enforces Listening -> Silent Processing -> Speaking -> Auto-Resume with zero overlap.',
            },
            {
              key: 'privacySandboxEnabled' as const,
              title: 'Privacy Sandbox Guard',
              desc: 'Redacts passwords, PINs, OTPs, bank details, and API keys before processing or calls.',
            },
            {
              key: 'bargeInEnabled' as const,
              title: 'Voice Interruption (Barge-In)',
              desc: 'Stop speaking immediately when you talk (active when Strict Turn-Taking is OFF).',
            },
            {
              key: 'wakeWordEnabled' as const,
              title: 'Wake Word Gate ("Hey Jarvis" / "Hey AL-SMAR")',
              desc: 'Only process utterances prefixed with the wake phrase.',
            },
            {
              key: 'echoCancellation' as const,
              title: 'Hardware Echo Cancellation',
              desc: 'Suppresses speaker audio from re-entering the mic.',
            },
            {
              key: 'noiseSuppression' as const,
              title: 'Background Noise Suppression',
              desc: 'Reduces ambient room noise during listening.',
            },
          ].map((item) => {
            const enabled = settings[item.key];
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onUpdateSettings({ [item.key]: !enabled })}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10 text-left hover:border-white/20 cursor-pointer"
              >
                <div>
                  <p className="text-xs font-medium text-white">{item.title}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                </div>
                <span
                  className={`text-xs font-mono shrink-0 ${
                    enabled ? 'text-[#F0C95C]' : 'text-slate-500'
                  }`}
                >
                  {enabled ? 'ON' : 'OFF'}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </motion.div>
  );
}

interface HistoryViewProps {
  logs: AutomationRunLog[];
  onReplayVoice: (text: string, lang?: string) => Promise<void>;
  onRerunCommand: (command: string) => Promise<void>;
  onClearHistory: () => void;
}

export function HistoryView({
  logs,
  onReplayVoice,
  onRerunCommand,
  onClearHistory,
}: HistoryViewProps) {
  return (
    <div className="h-full overflow-y-auto max-w-3xl mx-auto px-4 pt-4 pb-6 space-y-4">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-white">History</h2>
          <p className="text-xs text-slate-400">
            Recent voice exchanges, verified action plans, and spoken replies
          </p>
        </div>
        {logs.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>

      {logs.length === 0 ? (
        <div className="glass-panel rounded-2xl p-10 text-center">
          <History className="w-8 h-8 text-[#D4AF37]/70 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-200">No voice sessions logged yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Speak to AL-SMAR from the Home screen to record requests and verified actions here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="glass-panel rounded-2xl p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">“{log.command}”</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {log.timestamp} · {log.detectedLanguage.toUpperCase()} · {log.modelUsed} · {log.latencyMs}ms
                  </p>
                </div>
                <span
                  className={`text-xs font-mono ${
                    log.status === 'verified'
                      ? 'text-emerald-400'
                      : log.status === 'failed'
                        ? 'text-red-400'
                        : 'text-[#F0C95C]'
                  }`}
                >
                  {log.status}
                </span>
              </div>

              <p className="text-xs text-slate-200 leading-relaxed">{log.spokenResult}</p>

              {log.steps.length > 0 && (
                <div className="pt-2 border-t border-white/10 space-y-1">
                  {log.steps.map((s) => (
                    <div key={s.stepNumber} className="flex items-center justify-between text-[11px] text-slate-300">
                      <span>
                        {s.stepNumber}. {s.description}
                      </span>
                      <span className="font-mono text-slate-400">{s.status || 'done'}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => void onReplayVoice(log.spokenResult, log.detectedLanguage)}
                  className="inline-flex items-center gap-1.5 text-xs text-[#F0C95C] hover:underline cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  Replay Voice
                </button>
                <button
                  type="button"
                  onClick={() => void onRerunCommand(log.command)}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Re-run
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface SettingsViewProps {
  permissions: AndroidPermissionItem[];
  models: AIModelConfig[];
  routerMode: RouterMode;
  envStatus: ProviderEnvironmentStatus | null;
  device: VirtualDeviceState;
  androidFiles: AndroidSourceFile[];
  busy: boolean;
  onTogglePermission: (id: string) => Promise<void>;
  onChangeRouterMode: (mode: RouterMode) => void;
  onTestModel: (model: AIModelConfig) => Promise<void>;
  onRunCommand: (command: string) => Promise<void>;
  onQuickTapApp: (appName: string) => void;
  onQuickNav: (nav: 'back' | 'home' | 'recents') => void;
}

type SettingsTab = 'permissions' | 'automation' | 'models' | 'android';

export function SettingsView({
  permissions,
  models,
  routerMode,
  envStatus,
  device,
  androidFiles,
  busy,
  onTogglePermission,
  onChangeRouterMode,
  onTestModel,
  onRunCommand,
  onQuickTapApp,
  onQuickNav,
}: SettingsViewProps) {
  const [subtab, setSubtab] = useState<SettingsTab>('permissions');
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);

  const selectedFile = androidFiles[selectedFileIndex] || androidFiles[0];

  return (
    <div className="h-full overflow-y-auto max-w-4xl mx-auto px-4 pt-4 pb-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-white">Settings</h2>
          <p className="text-xs text-slate-400">
            Guided onboarding permissions, phone automation, AI models, and native Android export
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-[#060C20] p-1 rounded-xl border border-white/10">
          {(
            [
              { id: 'permissions', label: 'Permissions', icon: ShieldCheck },
              { id: 'automation', label: 'Phone', icon: Smartphone },
              { id: 'models', label: 'AI Models', icon: Cpu },
              { id: 'android', label: 'Android Code', icon: FileCode2 },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const active = subtab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubtab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  active ? 'bg-[#D4AF37] text-[#050814]' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {subtab === 'permissions' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-300">
            Minimal guided permission onboarding: Microphone & Notifications enable live voice mode; Accessibility is only requested when phone automation is used, and Camera only when Vision is triggered.
          </p>
          {permissions.map((perm) => (
            <div key={perm.id} className="glass-panel rounded-2xl p-4 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {perm.enabled ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                  <p className="text-sm font-semibold text-white">{perm.name}</p>
                </div>
                <p className="text-xs text-slate-300">{perm.rationale}</p>
                <p className="text-[11px] text-slate-500 font-mono">{perm.androidManifestPermission}</p>
              </div>
              <button
                type="button"
                onClick={() => void onTogglePermission(perm.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 cursor-pointer ${
                  perm.enabled
                    ? 'bg-white/10 text-slate-200 hover:bg-white/15'
                    : 'bg-[#D4AF37] text-[#050814] hover:bg-[#F0C95C]'
                }`}
              >
                {perm.enabled ? 'Enabled' : perm.browserTestable ? 'Grant Access' : 'Enable'}
              </button>
            </div>
          ))}
        </div>
      )}

      {subtab === 'automation' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 space-y-3">
            <div className="glass-panel rounded-2xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white">Multi-Step Voice Automation</h3>
              <p className="text-xs text-slate-400">
                Test multi-step Android Accessibility workflows with step verification and spoken result playback.
              </p>
              <div className="space-y-2">
                {[
                  'Open Instagram and search for Alsmar',
                  'Call Ali and put it on speaker',
                  'Activate Call Guardian and respond safely if caller asks for my bank PIN 4821',
                  'Run my Good Morning routine',
                  'Play Lo-Fi music on YouTube in full screen',
                  'Read and summarize my current screen',
                ].map((cmd) => (
                  <button
                    key={cmd}
                    type="button"
                    disabled={busy}
                    onClick={() => void onRunCommand(cmd)}
                    className="w-full text-left p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-[#D4AF37]/50 text-xs text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    “{cmd}”
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="lg:col-span-7">
            <VirtualPhonePanel
              device={device}
              onQuickTapApp={onQuickTapApp}
              onQuickNav={onQuickNav}
            />
          </div>
        </div>
      )}

      {subtab === 'models' && (
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl p-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#F0C95C]" />
                Model Routing Mode
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Smart Auto selects Gemini 4 Hydrogen for reasoning/automation and Gemini 3.8 Flash Lite TTS for real voice synthesis.
              </p>
            </div>
            <div className="flex items-center gap-1 bg-[#050918] p-1 rounded-xl border border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => onChangeRouterMode('smart-auto')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                  routerMode === 'smart-auto' ? 'bg-[#D4AF37] text-[#050814]' : 'text-slate-300'
                }`}
              >
                Smart Auto
              </button>
              <button
                type="button"
                onClick={() => onChangeRouterMode('manual')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                  routerMode === 'manual' ? 'bg-[#D4AF37] text-[#050814]' : 'text-slate-300'
                }`}
              >
                Manual
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {models.map((m) => (
              <div key={m.id} className="glass-panel rounded-2xl p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-white">{m.displayName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {m.modelName} · {m.description}
                  </p>
                  {m.statusMessage && (
                    <p className="text-[11px] text-[#F0C95C] mt-1 font-mono">{m.statusMessage}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void onTestModel(m)}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-medium text-white shrink-0 cursor-pointer"
                >
                  Test Connection
                </button>
              </div>
            ))}
          </div>

          <div className="glass-panel rounded-2xl p-4 text-xs text-slate-300 flex items-center justify-between">
            <span>Server Gemini Key Status</span>
            <span className={`font-mono ${envStatus?.gemini ? 'text-emerald-400' : 'text-red-400'}`}>
              {envStatus?.gemini ? 'Configured in Environment' : 'Missing GEMINI_API_KEY'}
            </span>
          </div>
        </div>
      )}

      {subtab === 'android' && (
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Jarvis Native Android Kotlin & Compose Project</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Complete Android Studio project: PrivacySandbox, LowLatencyVoicePipeline, AccessibilityService, CallGuardian, FloatingOrbOverlay, Routines & Gradle configs.
              </p>
            </div>
            <a
              href="/api/android-source/download"
              download="jarvis-android-project.zip"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#D4AF37] text-[#050814] text-xs font-semibold hover:bg-[#F0C95C] shrink-0"
            >
              <Download className="w-4 h-4" />
              Download .ZIP
            </a>
          </div>

          {androidFiles.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-4 space-y-1.5">
                {androidFiles.map((f, idx) => (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() => setSelectedFileIndex(idx)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-colors cursor-pointer ${
                      idx === selectedFileIndex
                        ? 'glass-panel-gold text-white'
                        : 'glass-panel text-slate-300 hover:text-white'
                    }`}
                  >
                    <p className="font-medium truncate">{f.module}</p>
                    <p className="text-[11px] text-slate-400 truncate font-mono">{f.path}</p>
                  </button>
                ))}
              </div>
              <div className="md:col-span-8 glass-panel rounded-2xl p-4 overflow-hidden">
                <p className="text-xs font-mono text-[#F0C95C] mb-2">{selectedFile?.path}</p>
                <pre className="text-[11px] font-mono text-slate-200 overflow-x-auto max-h-[380px] leading-relaxed">
                  {selectedFile?.content}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
