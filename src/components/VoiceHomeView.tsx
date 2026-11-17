import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Compass,
  Mic,
  MicOff,
  PhoneOff,
  RotateCcw,
  Settings,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { motion } from 'motion/react';
import type {
  AssistantState,
  FlightTelemetry,
  NeuralVoiceId,
  VoiceGender,
} from '../types/alsmar';
import { CockpitOrbScene } from './CockpitOrbScene';

interface VoiceHomeViewProps {
  state: AssistantState;
  isOnline: boolean;
  conversationActive: boolean;
  inputLevel: number;
  outputLevel: number;
  audioBars: number[];
  voiceGender: VoiceGender;
  voiceName: NeuralVoiceId;
  interimTranscript: string;
  lastSubtitle: string;
  errorMessage: string | null;
  hasRetryableSpeech: boolean;
  onStartConversation: () => void;
  onEndConversation: () => void;
  onCommitSpeech: () => void;
  onInterruptSpeech: () => void;
  onRetryVoice: () => void;
  onRetryLastCommand: () => void;
  onOpenSettings: () => void;
}

const STATE_LABELS: Record<AssistantState, string> = {
  IDLE: 'STANDBY',
  LISTENING: 'LISTENING',
  PROCESSING: 'PROCESSING',
  THINKING: 'ANALYZING',
  SPEAKING: 'SPEAKING',
  WAITING: 'READY',
  EXECUTING: 'EXECUTING',
  ERROR: 'ATTENTION NEEDED',
  OFFLINE: 'OFFLINE',
};

export function VoiceHomeView({
  state,
  isOnline,
  conversationActive,
  inputLevel,
  outputLevel,
  audioBars,
  voiceGender,
  voiceName,
  interimTranscript,
  lastSubtitle,
  errorMessage,
  hasRetryableSpeech,
  onStartConversation,
  onEndConversation,
  onCommitSpeech,
  onInterruptSpeech,
  onRetryVoice,
  onRetryLastCommand,
  onOpenSettings,
}: VoiceHomeViewProps) {
  const [telemetry, setTelemetry] = useState<FlightTelemetry>({
    altitudeFt: 34200,
    airspeedKts: 560,
    headingDeg: 42,
    waypointLabel: 'WPT-01 · ALPHA',
  });
  const [wavePhase, setWavePhase] = useState(0);

  useEffect(() => {
    if (
      state !== 'PROCESSING' &&
      state !== 'THINKING' &&
      state !== 'WAITING' &&
      state !== 'IDLE'
    ) {
      return;
    }
    let raf = 0;
    const step = (ts: number) => {
      setWavePhase(ts / 190);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  const effectiveOnline = isOnline && state !== 'OFFLINE';

  const getInstructionLine = () => {
    if (errorMessage) return errorMessage;
    if (!effectiveOnline) return 'No internet connection. Connect to continue voice conversation.';
    if (state === 'LISTENING') {
      return interimTranscript || 'Listening... Speak naturally in Hindi, Hinglish, English, or Urdu.';
    }
    if (state === 'PROCESSING') {
      return interimTranscript || 'Capturing speech & finalizing request...';
    }
    if (state === 'THINKING') {
      return interimTranscript ? `"${interimTranscript}"` : 'Formulating natural response...';
    }
    if (state === 'WAITING') {
      return lastSubtitle || 'Ready for your next command...';
    }
    if (state === 'EXECUTING') {
      return lastSubtitle || 'Executing verified device actions...';
    }
    if (state === 'SPEAKING') {
      return lastSubtitle || 'Speaking response... Speak or tap mic anytime to interrupt.';
    }
    return lastSubtitle || 'Tap the Arc-Reactor mic to start talking with JARVIS.';
  };

  const handlePrimaryMicPress = () => {
    if (state === 'SPEAKING') {
      onInterruptSpeech();
      return;
    }
    if (state === 'LISTENING' && conversationActive) {
      onCommitSpeech();
      return;
    }
    if (!conversationActive) {
      onStartConversation();
    }
  };

  const isPurplePhase = state === 'PROCESSING' || state === 'THINKING';
  const isGoldPhase = state === 'SPEAKING' || state === 'EXECUTING';
  const isBluePhase = state === 'LISTENING' || state === 'WAITING';
  const isErrPhase = state === 'ERROR' || state === 'OFFLINE';

  const micActive = conversationActive && state === 'LISTENING';
  const speakerActive = state === 'SPEAKING';
  const liveEnergy = state === 'LISTENING' ? inputLevel : state === 'SPEAKING' ? outputLevel : isPurplePhase ? 0.45 : 0.12;
  const ringStroke = isErrPhase
    ? '#F87171'
    : isGoldPhase
      ? '#F0C95C'
      : isPurplePhase
        ? '#C084FC'
        : '#38BDF8';

  return (
    <div className="relative h-full w-full overflow-hidden select-none">
      {/* Full-Viewport 3D JARVIS Arc-Reactor & Aviation Telemetry Canvas */}
      <div className="absolute inset-0 z-0">
        <CockpitOrbScene
          state={state}
          inputLevel={inputLevel}
          outputLevel={outputLevel}
          audioBars={audioBars}
          onTelemetry={setTelemetry}
          onOrbClick={handlePrimaryMicPress}
        />
      </div>

      {/* Subtle Radial Vignette for HUD Contrast */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_center,transparent_34%,rgba(2,6,18,0.78)_100%)]"
      />

      {/* Semantic JARVIS HUD Overlay (Zero backdrop-filter over WebGL) */}
      <div className="relative z-10 h-full w-full max-w-5xl mx-auto px-5 pt-4 pb-3 flex flex-col justify-between pointer-events-none">
        {/* Top Bar */}
        <header className="flex items-center justify-between gap-6 shrink-0 pointer-events-auto">
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-display text-lg font-semibold tracking-[0.26em] text-white whitespace-nowrap">
              AL-SMAR
            </span>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${
                effectiveOnline ? 'text-cyan-200/85' : 'text-red-400'
              }`}
            >
              {effectiveOnline ? (
                <Wifi className="w-3.5 h-3.5 text-[#F0C95C]" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-red-400" />
              )}
              <span>{effectiveOnline ? 'Online' : 'Offline'}</span>
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs font-mono tabular-nums text-cyan-200/80">
            <Compass className="w-3.5 h-3.5 text-[#F0C95C]" />
            <span>HDG {String(telemetry.headingDeg).padStart(3, '0')}°</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">{telemetry.waypointLabel}</span>
          </div>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open Settings"
            className="p-2.5 rounded-full text-cyan-200 hover:text-[#F0C95C] bg-[#04091A]/80 border border-cyan-400/20 hover:border-[#F0C95C]/50 transition-colors cursor-pointer shrink-0"
          >
            <Settings className="w-5 h-5" />
          </button>
        </header>

        {/* Outer Margin Cockpit Altitude & Airspeed Tapes */}
        <div className="flex-1 flex items-center justify-between min-h-0 px-1">
          <div className="hidden md:flex flex-col gap-1 px-3 py-2.5 rounded-xl bg-[#04091A]/75 border border-cyan-400/15 font-mono tabular-nums">
            <span className="text-[10px] tracking-[0.18em] text-slate-400">AIRSPEED</span>
            <span className="text-base font-semibold text-[#F0C95C]">
              {telemetry.airspeedKts} <span className="text-[11px] font-normal text-slate-400">KTS</span>
            </span>
          </div>

          <div className="hidden md:flex flex-col items-end gap-1 px-3 py-2.5 rounded-xl bg-[#04091A]/75 border border-cyan-400/15 font-mono tabular-nums">
            <span className="text-[10px] tracking-[0.18em] text-slate-400">ALTITUDE</span>
            <span className="text-base font-semibold text-cyan-300">
              {telemetry.altitudeFt.toLocaleString()} <span className="text-[11px] font-normal text-slate-400">FT</span>
            </span>
          </div>
        </div>

        {/* Bottom JARVIS Holographic Telemetry, Dual-Axis VFX Spectrum & Arc-Reactor Mic */}
        <div className="flex flex-col items-center text-center gap-3.5 shrink-0 pb-1 pointer-events-auto">
          <motion.div
            key={state}
            initial={{ opacity: 0.72, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`relative w-full max-w-xl px-5 py-3 overflow-hidden rounded-xl bg-[#030817]/82 border transition-colors ${
              isPurplePhase
                ? 'border-purple-400/40 shadow-[0_0_28px_rgba(168,85,247,0.16)]'
                : isGoldPhase
                  ? 'border-[#F0C95C]/45 shadow-[0_0_30px_rgba(240,201,92,0.18)]'
                  : isBluePhase
                    ? 'border-cyan-400/40 shadow-[0_0_28px_rgba(56,189,248,0.16)]'
                    : 'border-cyan-400/18'
            }`}
          >
            {/* Corner HUD Brackets */}
            <span aria-hidden="true" className="pointer-events-none absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400/75" />
            <span aria-hidden="true" className="pointer-events-none absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400/75" />
            <span aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#F0C95C]/75" />
            <span aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#F0C95C]/75" />

            {/* Holographic Horizontal Scanline Sweep */}
            <div
              aria-hidden="true"
              className="jarvis-scan-sweep pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent"
            />

            {/* System & Audio Telemetry Row (No exposed mood labels) */}
            <div className="relative flex items-center justify-between gap-2 text-[10px] font-mono tracking-[0.18em] mb-2">
              <span
                className={
                  isErrPhase
                    ? 'text-red-400 font-semibold'
                    : isGoldPhase
                      ? 'text-[#F0C95C] font-semibold'
                      : isPurplePhase
                        ? 'text-purple-300 font-semibold'
                        : isBluePhase
                          ? 'text-cyan-300 font-semibold'
                          : 'text-cyan-200/70'
                }
              >
                J.A.R.V.I.S · {STATE_LABELS[state]}
              </span>

              <div className="flex items-center gap-3 text-slate-300">
                <span className="inline-flex items-center gap-1">
                  {micActive ? (
                    <Mic className="w-3 h-3 text-cyan-300" />
                  ) : (
                    <MicOff className="w-3 h-3 text-slate-500" />
                  )}
                  <span className={micActive ? 'text-cyan-300' : 'text-slate-500'}>
                    {micActive ? 'MIC LIVE' : 'MIC'}
                  </span>
                </span>

                <span className="inline-flex items-center gap-1">
                  {speakerActive ? (
                    <Volume2 className="w-3 h-3 text-[#F0C95C]" />
                  ) : (
                    <VolumeX className="w-3 h-3 text-slate-500" />
                  )}
                  <span className={speakerActive ? 'text-[#F0C95C]' : 'text-slate-400'}>
                    {voiceGender.toUpperCase()} · {voiceName.toUpperCase()}
                  </span>
                </span>
              </div>
            </div>

            {/* Bi-Directional JARVIS Holographic Frequency Horizon */}
            <div
              aria-hidden="true"
              className="relative h-10 flex items-center justify-center gap-[3px] mb-2"
            >
              <div
                className="pointer-events-none absolute inset-x-4 top-1/2 -translate-y-1/2 h-[1px] opacity-50"
                style={{
                  background: `linear-gradient(90deg, transparent, ${ringStroke}, transparent)`,
                }}
              />
              {Array.from({ length: 32 }, (_, idx) => {
                const centerDist = Math.abs(idx - 15.5) / 15.5;
                const envelope = 1 - centerDist * 0.45;
                const liveLevel =
                  state === 'LISTENING' || state === 'SPEAKING'
                    ? (audioBars[idx % audioBars.length] ?? 0.08) * envelope
                    : isPurplePhase
                      ? (0.28 + Math.abs(Math.sin(wavePhase * 1.4 + idx * 0.38)) * 0.65) * envelope
                      : state === 'WAITING'
                        ? (0.16 + Math.abs(Math.sin(wavePhase * 0.7 + idx * 0.35)) * 0.24) * envelope
                        : (0.09 + Math.abs(Math.sin(wavePhase * 0.55 + idx * 0.28)) * 0.14) * envelope;

                const heightPct = Math.round(Math.min(100, Math.max(12, liveLevel * 100)));
                const barClass = isErrPhase
                  ? 'bg-red-400/80'
                  : isGoldPhase
                    ? 'bg-gradient-to-b from-[#FFF3C4] via-[#F0C95C] to-[#D4AF37] shadow-[0_0_10px_rgba(240,201,92,0.75)]'
                    : isPurplePhase
                      ? 'bg-gradient-to-b from-fuchsia-200 via-purple-400 to-indigo-400 shadow-[0_0_10px_rgba(192,132,252,0.75)]'
                      : isBluePhase
                        ? 'bg-gradient-to-b from-cyan-200 via-sky-400 to-blue-500 shadow-[0_0_10px_rgba(56,189,248,0.75)]'
                        : 'bg-cyan-400/45';
                return (
                  <span
                    key={idx}
                    style={{ height: `${heightPct}%` }}
                    className={`w-[3px] rounded-full transition-[height,background-color] duration-75 ${barClass}`}
                  />
                );
              })}
            </div>

            {/* Live Transcript / Spoken Caption */}
            <p
              className={`relative text-sm leading-relaxed line-clamp-2 min-h-[2.4rem] ${
                errorMessage ? 'text-red-200' : 'text-slate-100'
              }`}
            >
              {getInstructionLine()}
            </p>
          </motion.div>

          {(state === 'ERROR' || errorMessage) && (
            <div className="flex items-center justify-center gap-3">
              {hasRetryableSpeech && (
                <button
                  type="button"
                  onClick={onRetryVoice}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#D4AF37] text-[#050814] text-xs font-semibold hover:bg-[#F0C95C] transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  Retry Voice
                </button>
              )}
              <button
                type="button"
                onClick={onRetryLastCommand}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#09122C]/90 border border-white/15 text-white text-xs font-medium hover:bg-[#0E1C42] transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Retry Request
              </button>
            </div>
          )}

          {/* JARVIS Arc-Reactor Holographic Microphone Core & Controls */}
          <div className="flex items-center justify-center gap-6 pt-0.5">
            <div className="relative flex items-center justify-center w-28 h-28">
              {/* Outer Expanding VFX Ripple when active */}
              {(micActive || speakerActive || isPurplePhase) && (
                <span
                  aria-hidden="true"
                  className="jarvis-ripple pointer-events-none absolute inset-1 rounded-full border"
                  style={{ borderColor: ringStroke }}
                />
              )}

              {/* Rotating Outer Precision Calibrated SVG Reticle */}
              <svg
                aria-hidden="true"
                viewBox="0 0 120 120"
                className={`pointer-events-none absolute inset-0 w-full h-full ${
                  isPurplePhase || isGoldPhase || micActive ? 'jarvis-spin-fast' : 'jarvis-spin-slow'
                }`}
              >
                <circle
                  cx="60"
                  cy="60"
                  r="56"
                  fill="none"
                  stroke={ringStroke}
                  strokeOpacity="0.32"
                  strokeWidth="1.2"
                  strokeDasharray="10 6 3 6"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="49"
                  fill="none"
                  stroke="#F0C95C"
                  strokeOpacity="0.45"
                  strokeWidth="1.4"
                  strokeDasharray="24 14 8 14"
                />
              </svg>

              {/* Counter-Rotating Inner Reactor Ring */}
              <svg
                aria-hidden="true"
                viewBox="0 0 120 120"
                className="jarvis-spin-reverse pointer-events-none absolute inset-0 w-full h-full"
              >
                <circle
                  cx="60"
                  cy="60"
                  r="42"
                  fill="none"
                  stroke={ringStroke}
                  strokeOpacity="0.6"
                  strokeWidth="1.6"
                  strokeDasharray="16 12"
                />
              </svg>

              {/* Audio-Reactive Aura Scale */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-3 rounded-full transition-transform duration-75"
                style={{
                  transform: `scale(${1 + liveEnergy * 0.22})`,
                  boxShadow: `0 0 ${18 + Math.round(liveEnergy * 28)}px ${ringStroke}55`,
                }}
              />

              <button
                type="button"
                onClick={handlePrimaryMicPress}
                aria-label={
                  state === 'SPEAKING'
                    ? 'Interrupt and speak'
                    : conversationActive
                      ? 'Tap to send speech or keep speaking'
                      : 'Start voice conversation'
                }
                className={`relative z-10 w-[72px] h-[72px] rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer shadow-2xl ${
                  isErrPhase
                    ? 'bg-red-950/90 border-2 border-red-400/80 text-red-200 hover:bg-red-900'
                    : isPurplePhase
                      ? 'bg-gradient-to-b from-purple-700 to-[#140A2E] border-2 border-purple-300 text-purple-100'
                      : isGoldPhase
                        ? 'bg-gradient-to-b from-[#9E7B22] via-[#5C440F] to-[#1A1305] border-2 border-[#F0C95C] text-[#FFF3C4]'
                        : conversationActive
                          ? 'bg-gradient-to-b from-sky-500 via-[#1D4ED8] to-[#081538] border-2 border-cyan-300 text-white'
                          : 'bg-gradient-to-b from-[#16368A] to-[#081230] border border-cyan-300/60 text-cyan-100 hover:border-[#F0C95C] hover:scale-[1.04]'
                }`}
              >
                {state === 'ERROR' ? (
                  <AlertTriangle className="w-7 h-7" />
                ) : state === 'SPEAKING' ? (
                  <Volume2 className="w-7 h-7" />
                ) : (
                  <Mic className="w-7 h-7" />
                )}
              </button>
            </div>

            {conversationActive && (
              <button
                type="button"
                onClick={onEndConversation}
                aria-label="End Conversation"
                className="h-12 px-5 rounded-full bg-red-950/85 border border-red-500/45 text-red-100 hover:bg-red-900 transition-colors inline-flex items-center gap-2 text-sm font-medium cursor-pointer whitespace-nowrap"
              >
                <PhoneOff className="w-4 h-4" />
                <span>End</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
