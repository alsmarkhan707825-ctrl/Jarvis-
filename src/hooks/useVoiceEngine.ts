import { useCallback, useEffect, useRef, useState } from 'react';
import type { AssistantState, EmotionalState, VoiceSettingsConfig } from '../types/alsmar';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

interface UseVoiceEngineOptions {
  settings: VoiceSettingsConfig;
  state: AssistantState;
  setState: (next: AssistantState) => void;
  onUserUtterance: (transcript: string) => Promise<void>;
  onBargeIn?: () => void;
  onError: (msg: string | null) => void;
}

export interface SpeakResult {
  ok: boolean;
  interrupted?: boolean;
  error?: string;
}

interface QueuedAudioItem {
  generation: number;
  text: string;
  lang?: string;
  emotion?: EmotionalState;
  bufferPromise: Promise<AudioBuffer>;
  onStart?: (text: string) => void;
}

const INCOMPLETE_TRAILING_REGEX =
  /\b(?:and|or|but|so|because|if|when|while|with|to|for|from|um|uh|aur|lekin|par|toh|kyunki|agar|ya|ke|ki|ka)$/i;

function computeAdaptiveVadMs(text: string, baseMs: number): number {
  const trimmed = text.trim();
  if (!trimmed) return baseMs;
  if (/[.!?।]$/.test(trimmed)) {
    return Math.max(580, baseMs - 380);
  }
  if (INCOMPLETE_TRAILING_REGEX.test(trimmed)) {
    return Math.min(2800, baseMs + 700);
  }
  return baseMs;
}

function mapRecognitionLocale(lang: VoiceSettingsConfig['preferredLanguage']): string {
  if (lang === 'hi') return 'hi-IN';
  if (lang === 'ur') return 'ur-PK';
  if (lang === 'hinglish') return 'en-IN';
  if (lang === 'en') return 'en-US';
  return typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-IN';
}

function mapSynthesisLocale(lang?: string): string {
  if (lang === 'hi') return 'hi-IN';
  if (lang === 'ur') return 'ur-PK';
  if (lang === 'hinglish') return 'en-IN';
  return 'en-US';
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const cleaned = base64.replace(/^data:[^;]+;base64,/, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to encode audio buffer'));
    reader.readAsDataURL(blob);
  });
}

export function useVoiceEngine({
  settings,
  state,
  setState,
  onUserUtterance,
  onBargeIn,
  onError,
}: UseVoiceEngineOptions) {
  const [conversationActive, setConversationActive] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const [audioBars, setAudioBars] = useState<number[]>(() => Array(24).fill(0.05));
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [hasRetryableSpeech, setHasRetryableSpeech] = useState(false);
  const [activeEmotion, setActiveEmotion] = useState<EmotionalState>('normal');
  const activeEmotionRef = useRef<EmotionalState>('normal');
  activeEmotionRef.current = activeEmotion;

  const speechSupported =
    typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const stateRef = useRef(state);
  stateRef.current = state;
  const conversationActiveRef = useRef(conversationActive);
  conversationActiveRef.current = conversationActive;
  const onUtteranceRef = useRef(onUserUtterance);
  onUtteranceRef.current = onUserUtterance;
  const onBargeInRef = useRef(onBargeIn);
  onBargeInRef.current = onBargeIn;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const playbackCtxRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const ttsAnalyserRef = useRef<AnalyserNode | null>(null);
  const ttsRafRef = useRef<number>(0);
  const speakingStartedAtRef = useRef<number>(0);
  const lastSpeechRef = useRef<{ text: string; lang?: string } | null>(null);

  // Streaming TTS Queue State
  const speechGenerationRef = useRef<number>(0);
  const streamControllersRef = useRef<Set<AbortController>>(new Set());
  const streamQueueRef = useRef<QueuedAudioItem[]>([]);
  const streamProducerDoneRef = useRef<boolean>(true);
  const streamRunnerActiveRef = useRef<boolean>(false);
  const streamResolversRef = useRef<Array<(res: SpeakResult) => void>>([]);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micRafRef = useRef<number>(0);

  const pendingFinalRef = useRef('');
  const lastInterimRef = useRef('');
  const sttProducedTextRef = useRef(false);
  const vadTimerRef = useRef<number | null>(null);
  const lastSubmittedRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const processingUtteranceRef = useRef(false);
  const bargeInFramesRef = useRef(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const speechDetectedInClipRef = useRef(false);
  const speechFramesRef = useRef(0);
  const clipPeakLevelRef = useRef(0);
  const silenceMsRef = useRef(0);
  const clipDurationMsRef = useRef(0);
  const commitRecordedClipRef = useRef(false);

  const clearVadTimer = useCallback(() => {
    if (vadTimerRef.current !== null) {
      window.clearTimeout(vadTimerRef.current);
      vadTimerRef.current = null;
    }
  }, []);

  const ensurePlaybackContext = useCallback(async (): Promise<AudioContext> => {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      throw new Error('Web Audio API is not supported in this browser.');
    }
    if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
      playbackCtxRef.current = new AudioCtx();
    }
    if (playbackCtxRef.current.state === 'suspended') {
      await playbackCtxRef.current.resume();
    }
    setAudioUnlocked(playbackCtxRef.current.state === 'running');
    return playbackCtxRef.current;
  }, []);

  const unlockAudio = useCallback(async (): Promise<boolean> => {
    try {
      const ctx = await ensurePlaybackContext();
      return ctx.state === 'running';
    } catch {
      return false;
    }
  }, [ensurePlaybackContext]);

  const stopSpeechMeter = useCallback(() => {
    if (ttsRafRef.current) {
      cancelAnimationFrame(ttsRafRef.current);
      ttsRafRef.current = 0;
    }
    setOutputLevel(0);
  }, []);

  const resolveStreamWaiters = useCallback((result: SpeakResult) => {
    const waiters = streamResolversRef.current;
    streamResolversRef.current = [];
    waiters.forEach((fn) => fn(result));
  }, []);

  const stopSpeaking = useCallback(() => {
    speechGenerationRef.current += 1;
    streamControllersRef.current.forEach((c) => c.abort());
    streamControllersRef.current.clear();
    streamQueueRef.current = [];
    streamProducerDoneRef.current = true;
    streamRunnerActiveRef.current = false;

    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.onended = null;
        activeSourceRef.current.stop();
        activeSourceRef.current.disconnect();
      } catch {
        // Ignore stopped buffer source
      }
      activeSourceRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    stopSpeechMeter();
    resolveStreamWaiters({ ok: true, interrupted: true });
  }, [resolveStreamWaiters, stopSpeechMeter]);

  const stopRecognitionOnly = useCallback(() => {
    clearVadTimer();
    commitRecordedClipRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch {
        // Ignore abort errors
      }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.ondataavailable = null;
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore stop errors
      }
      mediaRecorderRef.current = null;
    }
    recordedChunksRef.current = [];
  }, [clearVadTimer]);

  const stopMicHardware = useCallback(() => {
    stopRecognitionOnly();
    if (micRafRef.current) {
      cancelAnimationFrame(micRafRef.current);
      micRafRef.current = 0;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (micCtxRef.current && micCtxRef.current.state !== 'closed') {
      micCtxRef.current.close().catch(() => {});
      micCtxRef.current = null;
    }
    micAnalyserRef.current = null;
    setInputLevel(0);
    setAudioBars(Array(24).fill(0.05));
    setInterimTranscript('');
    pendingFinalRef.current = '';
  }, [stopRecognitionOnly]);

  const submitTranscript = useCallback(
    async (rawText: string) => {
      const cleaned = rawText.trim();
      if (!cleaned || processingUtteranceRef.current) return;

      const now = Date.now();
      if (lastSubmittedRef.current.text === cleaned && now - lastSubmittedRef.current.at < 1500) {
        return;
      }

      if (settingsRef.current.wakeWordEnabled) {
        const wake = settingsRef.current.wakeWordPhrase.trim().toLowerCase();
        const lower = cleaned.toLowerCase();
        const matched =
          (wake && lower.includes(wake)) ||
          lower.includes('hey jarvis') ||
          lower.includes('hey al-smar') ||
          lower.includes('hey alsmar');
        if (!matched) {
          setInterimTranscript(`Say "${settingsRef.current.wakeWordPhrase}" or "Hey AL-SMAR" to activate`);
          return;
        }
      }

      lastSubmittedRef.current = { text: cleaned, at: now };
      processingUtteranceRef.current = true;
      clearVadTimer();
      stopRecognitionOnly();
      setInterimTranscript('');
      pendingFinalRef.current = '';
      lastInterimRef.current = '';
      sttProducedTextRef.current = false;
      setState('PROCESSING');

      try {
        await onUtteranceRef.current(cleaned);
      } finally {
        processingUtteranceRef.current = false;
      }
    },
    [clearVadTimer, setState, stopRecognitionOnly]
  );

  const startAudioClipRecorder = useCallback(() => {
    const stream = micStreamRef.current;
    if (!stream || typeof MediaRecorder === 'undefined') return;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.ondataavailable = null;
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore stop errors
      }
    }

    try {
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
      const mimeType = candidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recordedChunksRef.current = [];
      speechDetectedInClipRef.current = false;
      speechFramesRef.current = 0;
      clipPeakLevelRef.current = 0;
      silenceMsRef.current = 0;
      clipDurationMsRef.current = 0;
      commitRecordedClipRef.current = false;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          recordedChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        const shouldCommit = commitRecordedClipRef.current;
        const chunks = recordedChunksRef.current;
        recordedChunksRef.current = [];
        commitRecordedClipRef.current = false;

        if (
          !shouldCommit ||
          chunks.length === 0 ||
          !conversationActiveRef.current ||
          processingUtteranceRef.current ||
          sttProducedTextRef.current
        ) {
          return;
        }

        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size < 900 || clipPeakLevelRef.current < 0.04) {
          if (conversationActiveRef.current && stateRef.current === 'LISTENING') {
            startAudioClipRecorder();
          }
          return;
        }

        // Stop speech recognition while transcribing audio clip
        if (recognitionRef.current) {
          try {
            recognitionRef.current.onresult = null;
            recognitionRef.current.onerror = null;
            recognitionRef.current.onend = null;
            recognitionRef.current.abort();
          } catch {
            // Ignore
          }
          recognitionRef.current = null;
        }

        setState('PROCESSING');
        setInterimTranscript('Transcribing your voice...');
        try {
          const audioBase64 = await blobToBase64(blob);
          const resp = await fetch('/api/ai/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioBase64, mimeType: blob.type || 'audio/webm' }),
          });
          const data = (await resp.json()) as { transcript?: string; error?: string };
          if (!resp.ok) {
            throw new Error(data.error || 'Voice transcription failed');
          }
          const transcribed = (data.transcript || '').trim();
          if (transcribed) {
            setInterimTranscript(transcribed);
            await submitTranscript(transcribed);
          } else if (conversationActiveRef.current) {
            setInterimTranscript('');
            setState('LISTENING');
            startAudioClipRecorder();
          }
        } catch (err) {
          onErrorRef.current(err instanceof Error ? err.message : 'Unable to transcribe audio');
          if (conversationActiveRef.current) {
            setState('LISTENING');
            startAudioClipRecorder();
          } else {
            setState('ERROR');
          }
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(200);
    } catch {
      // If MediaRecorder is blocked, SpeechRecognition remains active
    }
  }, [setState, submitTranscript]);

  const startSpeechCapture = useCallback(() => {
    if (
      !conversationActiveRef.current ||
      stateRef.current === 'SPEAKING' ||
      processingUtteranceRef.current
    ) {
      return;
    }

    stopRecognitionOnly();
    pendingFinalRef.current = '';
    lastInterimRef.current = '';
    sttProducedTextRef.current = false;
    setInterimTranscript('');

    // Always start reliable audio clip capture + RMS/speech-band VAD in parallel
    startAudioClipRecorder();

    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      return;
    }

    try {
      const rec = new Ctor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = mapRecognitionLocale(settingsRef.current.preferredLanguage);

      rec.onresult = (event: SpeechRecognitionEventLike) => {
        if (stateRef.current === 'SPEAKING' || processingUtteranceRef.current) return;
        let interim = '';
        let finalSeg = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const chunk = result[0]?.transcript || '';
          if (result.isFinal) {
            finalSeg += ` ${chunk}`;
          } else {
            interim += ` ${chunk}`;
          }
        }

        if (finalSeg.trim()) {
          pendingFinalRef.current = `${pendingFinalRef.current} ${finalSeg}`.trim();
        }
        if (interim.trim()) {
          lastInterimRef.current = interim.trim();
        }

        const display = `${pendingFinalRef.current} ${interim}`.trim();
        if (display) {
          sttProducedTextRef.current = true;
          setInterimTranscript(display);
        }

        clearVadTimer();
        if (pendingFinalRef.current.trim()) {
          const adaptiveDelay = computeAdaptiveVadMs(
            pendingFinalRef.current,
            settingsRef.current.vadSilenceMs
          );
          vadTimerRef.current = window.setTimeout(() => {
            const committed = pendingFinalRef.current.trim();
            if (committed) {
              void submitTranscript(committed);
            }
          }, adaptiveDelay);
        } else if (interim.trim()) {
          const adaptiveInterimDelay = computeAdaptiveVadMs(
            interim,
            settingsRef.current.vadSilenceMs + 420
          );
          vadTimerRef.current = window.setTimeout(() => {
            const committed = `${pendingFinalRef.current} ${lastInterimRef.current}`.trim();
            if (committed) {
              void submitTranscript(committed);
            }
          }, adaptiveInterimDelay);
        }
      };

      rec.onerror = (ev) => {
        const errCode = ev.error || 'unknown';
        if (errCode === 'aborted' || errCode === 'no-speech') return;
        if (errCode === 'network' && !navigator.onLine) {
          setState('OFFLINE');
          onErrorRef.current('Network connection lost. Please check your internet.');
        }
        // Any other SpeechRecognition failure automatically relies on MediaRecorder + /api/ai/transcribe
      };

      rec.onend = () => {
        if (
          conversationActiveRef.current &&
          stateRef.current === 'LISTENING' &&
          !processingUtteranceRef.current &&
          !commitRecordedClipRef.current
        ) {
          window.setTimeout(() => {
            if (
              conversationActiveRef.current &&
              stateRef.current === 'LISTENING' &&
              !processingUtteranceRef.current &&
              !recognitionRef.current
            ) {
              try {
                rec.start();
                recognitionRef.current = rec;
              } catch {
                // MediaRecorder remains active as primary safety net
              }
            }
          }, 180);
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch {
      // MediaRecorder continues seamlessly
    }
  }, [clearVadTimer, setState, startAudioClipRecorder, stopRecognitionOnly, submitTranscript]);

  const commitCurrentSpeech = useCallback(() => {
    if (stateRef.current !== 'LISTENING' || processingUtteranceRef.current) return;
    const directText = `${pendingFinalRef.current} ${lastInterimRef.current}`.trim();
    if (directText) {
      void submitTranscript(directText);
      return;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      if (recordedChunksRef.current.length > 0) {
        commitRecordedClipRef.current = true;
        mediaRecorderRef.current.stop();
      }
    }
  }, [submitTranscript]);

  const startMicAnalyserLoop = useCallback(
    (stream: MediaStream) => {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      if (micCtxRef.current && micCtxRef.current.state !== 'closed') {
        micCtxRef.current.close().catch(() => {});
      }
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);

      micCtxRef.current = ctx;
      micAnalyserRef.current = analyser;
      const freqData = new Uint8Array(analyser.frequencyBinCount);
      const timeData = new Uint8Array(analyser.fftSize);
      let lastTick = performance.now();

      const tick = (now: number) => {
        const dt = Math.min(now - lastTick, 120);
        lastTick = now;
        if (!micAnalyserRef.current) return;

        micAnalyserRef.current.getByteFrequencyData(freqData);
        micAnalyserRef.current.getByteTimeDomainData(timeData);

        // Vocal-band energy (bins 1..14 covers ~150Hz - 3.5kHz) + time-domain RMS for reliable soft-mic detection
        let vocalSum = 0;
        const vocalBins = Math.min(14, freqData.length);
        for (let i = 1; i < vocalBins; i += 1) vocalSum += freqData[i];
        const vocalLevel = vocalSum / (Math.max(1, vocalBins - 1) * 140);

        let sqSum = 0;
        for (let i = 0; i < timeData.length; i += 1) {
          const norm = (timeData[i] - 128) / 128;
          sqSum += norm * norm;
        }
        const rms = Math.sqrt(sqSum / timeData.length);
        const level = Math.min(1, Math.max(vocalLevel, rms * 3.2));

        if (stateRef.current === 'LISTENING') {
          setInputLevel(level);
          const bars = Array.from({ length: 24 }, (_, idx) => {
            const val = freqData[(idx % Math.max(1, vocalBins)) + 1] ?? 0;
            return Math.min(1, Math.max(0.06, Math.max(val / 180, rms * 2.1)));
          });
          setAudioBars(bars);

          if (
            mediaRecorderRef.current &&
            mediaRecorderRef.current.state === 'recording' &&
            !sttProducedTextRef.current &&
            !processingUtteranceRef.current
          ) {
            clipDurationMsRef.current += dt;
            if (level > clipPeakLevelRef.current) {
              clipPeakLevelRef.current = level;
            }
            if (level > 0.065) {
              speechFramesRef.current += 1;
              if (speechFramesRef.current >= 3) {
                speechDetectedInClipRef.current = true;
              }
              silenceMsRef.current = 0;
            } else if (speechDetectedInClipRef.current) {
              silenceMsRef.current += dt;
              if (
                silenceMsRef.current >= settingsRef.current.vadSilenceMs ||
                clipDurationMsRef.current >= 14000
              ) {
                commitRecordedClipRef.current = true;
                mediaRecorderRef.current.stop();
              }
            } else if (clipDurationMsRef.current >= 9000) {
              // Recycle silent buffer cleanly every 9s so clips stay tight & responsive
              commitRecordedClipRef.current = false;
              mediaRecorderRef.current.stop();
              window.setTimeout(() => {
                if (
                  conversationActiveRef.current &&
                  stateRef.current === 'LISTENING' &&
                  !processingUtteranceRef.current
                ) {
                  startAudioClipRecorder();
                }
              }, 80);
            }
          }
        } else if (
          stateRef.current === 'SPEAKING' &&
          !settingsRef.current.strictTurnTaking &&
          settingsRef.current.bargeInEnabled &&
          Date.now() - speakingStartedAtRef.current > 500
        ) {
          if (rms > 0.085) {
            bargeInFramesRef.current += 1;
            if (bargeInFramesRef.current >= 5) {
              bargeInFramesRef.current = 0;
              stopSpeaking();
              onBargeInRef.current?.();
              if (conversationActiveRef.current) {
                setState('LISTENING');
                window.setTimeout(() => startSpeechCapture(), 90);
              } else {
                setState('IDLE');
              }
            }
          } else {
            bargeInFramesRef.current = 0;
          }
        } else {
          bargeInFramesRef.current = 0;
        }

        micRafRef.current = requestAnimationFrame(tick);
      };

      micRafRef.current = requestAnimationFrame(tick);
    },
    [setState, startAudioClipRecorder, startSpeechCapture, stopSpeaking]
  );

  const startConversation = useCallback(async () => {
    onErrorRef.current(null);
    await unlockAudio();

    if (!navigator.onLine) {
      setState('OFFLINE');
      const offlineMsg = 'You are offline right now. Please connect to the internet and try again.';
      onErrorRef.current(offlineMsg);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(offlineMsg));
      }
      return;
    }

    try {
      if (!micStreamRef.current) {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Microphone access is unavailable in this browser context.');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: settingsRef.current.echoCancellation,
            noiseSuppression: settingsRef.current.noiseSuppression,
            autoGainControl: true,
          },
        });
        micStreamRef.current = stream;
        setMicPermissionGranted(true);
        startMicAnalyserLoop(stream);
      }

      conversationActiveRef.current = true;
      setConversationActive(true);
      setState('LISTENING');
      startSpeechCapture();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Microphone permission denied. Allow microphone access to talk with AL-SMAR.';
      onErrorRef.current(msg);
      setState('ERROR');
      setConversationActive(false);
    }
  }, [setState, startMicAnalyserLoop, startSpeechCapture, unlockAudio]);

  const endConversation = useCallback(() => {
    conversationActiveRef.current = false;
    setConversationActive(false);
    processingUtteranceRef.current = false;
    stopSpeaking();
    stopMicHardware();
    onErrorRef.current(null);
    setState('IDLE');
  }, [setState, stopMicHardware, stopSpeaking]);

  const synthesizeChunkBuffer = useCallback(
    async (
      text: string,
      lang: string | undefined,
      emotion: EmotionalState | undefined,
      generation: number
    ): Promise<AudioBuffer> => {
      const ctx = await ensurePlaybackContext();
      if (ctx.state !== 'running') {
        throw new Error('Audio output is locked by browser. Tap Retry Voice to allow sound.');
      }

      const controller = new AbortController();
      streamControllersRef.current.add(controller);

      try {
        const chosenEmotion = emotion || activeEmotionRef.current || 'normal';
        const resp = await fetch('/api/ai/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            text,
            voiceName: settingsRef.current.neuralVoice,
            gender: settingsRef.current.preferredGender,
            emotion: chosenEmotion,
            style: `Speak naturally in ${lang || settingsRef.current.preferredLanguage} with a ${chosenEmotion} emotional tone.`,
          }),
        });

        const payload = (await resp.json()) as {
          audioBase64?: string;
          mimeType?: string;
          error?: string;
        };

        if (speechGenerationRef.current !== generation) {
          throw new Error('ABORTED_BY_GENERATION');
        }
        if (!resp.ok || !payload.audioBase64) {
          throw new Error(payload.error || 'Voice synthesizer returned no audio bytes.');
        }

        const rawBuf = base64ToArrayBuffer(payload.audioBase64);
        if (rawBuf.byteLength < 64) {
          throw new Error('Synthesized audio buffer was empty.');
        }
        const audioBuffer = await ctx.decodeAudioData(rawBuf);
        if (!audioBuffer || audioBuffer.duration <= 0) {
          throw new Error('Decoded audio has zero duration.');
        }
        return audioBuffer;
      } finally {
        streamControllersRef.current.delete(controller);
      }
    },
    [ensurePlaybackContext]
  );

  const playSingleAudioBuffer = useCallback(
    async (audioBuffer: AudioBuffer, generation: number): Promise<void> => {
      const ctx = await ensurePlaybackContext();
      if (speechGenerationRef.current !== generation) return;

      return new Promise<void>((resolve, reject) => {
        if (speechGenerationRef.current !== generation) {
          resolve();
          return;
        }

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.playbackRate.value = settingsRef.current.speechRate;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.72;
        ttsAnalyserRef.current = analyser;

        const gainNode = ctx.createGain();
        gainNode.gain.value = 1.0;

        source.connect(analyser);
        analyser.connect(gainNode);
        gainNode.connect(ctx.destination);

        activeSourceRef.current = source;
        if (stateRef.current !== 'SPEAKING') {
          speakingStartedAtRef.current = Date.now();
          setState('SPEAKING');
        }

        const freqData = new Uint8Array(analyser.frequencyBinCount);
        const updateMeter = () => {
          if (!ttsAnalyserRef.current || activeSourceRef.current !== source) return;
          ttsAnalyserRef.current.getByteFrequencyData(freqData);
          let sum = 0;
          for (let i = 0; i < freqData.length; i += 1) sum += freqData[i];
          const avg = Math.min(1, sum / (freqData.length * 100));
          setOutputLevel(avg);
          setAudioBars(
            Array.from({ length: 24 }, (_, idx) => {
              const v = freqData[idx % freqData.length] ?? 0;
              return Math.min(1, Math.max(0.06, v / 195));
            })
          );
          ttsRafRef.current = requestAnimationFrame(updateMeter);
        };
        ttsRafRef.current = requestAnimationFrame(updateMeter);

        source.onended = () => {
          activeSourceRef.current = null;
          stopSpeechMeter();
          resolve();
        };

        try {
          source.start(0);
        } catch (playErr) {
          activeSourceRef.current = null;
          stopSpeechMeter();
          reject(playErr instanceof Error ? playErr : new Error('Audio playback failed to start.'));
        }
      });
    },
    [ensurePlaybackContext, setState, stopSpeechMeter]
  );

  const pickBestNaturalVoice = (lang: string | undefined, gender: 'male' | 'female') => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    const targetLang = mapSynthesisLocale(lang).toLowerCase().slice(0, 2);
    const maleHints = /(male|daniel|david|guy|ryan|andrew|christopher|alex|aaron|rishi|prabhat|madhur|charon|fenrir)/i;
    const femaleHints = /(female|samantha|aria|jenny|sonia|libby|neerja|swara|zoya|karen|moira|tessa|victoria)/i;
    const genderRegex = gender === 'female' ? femaleHints : maleHints;

    return [...voices].sort((a, b) => {
      const score = (v: SpeechSynthesisVoice) => {
        let s = 0;
        const n = v.name.toLowerCase();
        if (v.lang.toLowerCase().startsWith(targetLang)) s += 40;
        else if (v.lang.toLowerCase().startsWith('en')) s += 15;
        if (/natural|neural|online|google/i.test(n)) s += 50;
        if (/espeak|mbrola|festival/i.test(n)) s -= 100;
        if (genderRegex.test(n)) s += 25;
        if (!v.localService) s += 12;
        return s;
      };
      return score(b) - score(a);
    })[0];
  };

  const speakWithBrowserFallback = useCallback(
    async (text: string, lang?: string, generation?: number): Promise<SpeakResult> => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        return { ok: false, error: 'Speech synthesis is unavailable in this browser.' };
      }
      if (generation !== undefined && speechGenerationRef.current !== generation) {
        return { ok: true, interrupted: true };
      }
      return new Promise((resolve) => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = mapSynthesisLocale(lang);
        const chosenVoice = pickBestNaturalVoice(lang, settingsRef.current.preferredGender);
        if (chosenVoice) {
          utterance.voice = chosenVoice;
        }
        const emo = activeEmotionRef.current;
        const basePitch = settingsRef.current.preferredGender === 'female' ? 1.06 : 0.96;
        utterance.pitch =
          emo === 'happy' || emo === 'laughing' || emo === 'surprised'
            ? basePitch + 0.06
            : emo === 'sad' || emo === 'caring' || emo === 'serious'
              ? Math.max(0.82, basePitch - 0.06)
              : basePitch;
        utterance.rate =
          emo === 'thinking' || emo === 'sad'
            ? Math.max(0.86, settingsRef.current.speechRate - 0.06)
            : emo === 'happy' || emo === 'surprised'
              ? Math.min(1.18, settingsRef.current.speechRate + 0.04)
              : settingsRef.current.speechRate;

        let settled = false;
        let pulseTimer: number | null = null;
        const done = (res: SpeakResult) => {
          if (settled) return;
          settled = true;
          if (pulseTimer !== null) window.clearInterval(pulseTimer);
          setOutputLevel(0);
          resolve(res);
        };

        utterance.onstart = () => {
          if (generation !== undefined && speechGenerationRef.current !== generation) {
            window.speechSynthesis.cancel();
            done({ ok: true, interrupted: true });
            return;
          }
          speakingStartedAtRef.current = Date.now();
          setState('SPEAKING');
          pulseTimer = window.setInterval(() => {
            if (generation !== undefined && speechGenerationRef.current !== generation) {
              window.speechSynthesis.cancel();
              done({ ok: true, interrupted: true });
              return;
            }
            const nowSec = performance.now() / 160;
            const lvl = 0.35 + Math.abs(Math.sin(nowSec)) * 0.45;
            setOutputLevel(lvl);
            setAudioBars(
              Array.from({ length: 24 }, (_, idx) =>
                Math.min(1, Math.max(0.12, 0.25 + Math.abs(Math.sin(nowSec + idx * 0.42)) * 0.65))
              )
            );
          }, 50);
        };
        utterance.onend = () => done({ ok: true });
        utterance.onerror = () => done({ ok: false, error: 'Local fallback speech failed to play.' });

        window.speechSynthesis.speak(utterance);
        window.setTimeout(() => {
          if (!settled && !window.speechSynthesis.speaking) {
            done({ ok: false, error: 'Browser blocked automatic voice playback.' });
          }
        }, 900);
      });
    },
    [setState]
  );

  const fallbackGenerationRef = useRef<number>(-1);

  const runStreamPlaybackQueue = useCallback(
    async (generation: number) => {
      if (streamRunnerActiveRef.current) return;
      streamRunnerActiveRef.current = true;

      try {
        while (speechGenerationRef.current === generation) {
          const nextItem = streamQueueRef.current.shift();
          if (!nextItem) {
            if (streamProducerDoneRef.current) {
              break;
            }
            await new Promise((r) => setTimeout(r, 30));
            continue;
          }

          if (nextItem.generation !== generation) continue;

          let buffer: AudioBuffer | null = null;
          let neuralErrMsg: string | null = null;

          if (fallbackGenerationRef.current !== generation) {
            try {
              buffer = await nextItem.bufferPromise;
            } catch (err) {
              neuralErrMsg = err instanceof Error ? err.message : 'Voice playback error.';
              if (neuralErrMsg === 'ABORTED_BY_GENERATION' || speechGenerationRef.current !== generation) {
                throw new Error('ABORTED_BY_GENERATION');
              }
              fallbackGenerationRef.current = generation;
            }
          }

          if (speechGenerationRef.current !== generation) break;

          if (buffer) {
            nextItem.onStart?.(nextItem.text);
            await playSingleAudioBuffer(buffer, generation);
          } else {
            nextItem.onStart?.(nextItem.text);
            const fallbackRes = await speakWithBrowserFallback(nextItem.text, nextItem.lang, generation);
            if (!fallbackRes.ok && !fallbackRes.interrupted) {
              throw new Error(neuralErrMsg || fallbackRes.error || 'Voice playback failed.');
            }
          }
        }

        if (speechGenerationRef.current === generation) {
          streamRunnerActiveRef.current = false;
          if (conversationActiveRef.current) {
            setState('WAITING');
            // Acoustic speaker-tail guard prevents AI voice echo from triggering STT
            window.setTimeout(() => {
              if (conversationActiveRef.current && stateRef.current === 'WAITING') {
                setState('LISTENING');
                startSpeechCapture();
              }
            }, 220);
          } else {
            setState('IDLE');
          }
          resolveStreamWaiters({ ok: true });
        }
      } catch (err) {
        streamRunnerActiveRef.current = false;
        const msg = err instanceof Error ? err.message : 'Voice playback error.';
        if (msg === 'ABORTED_BY_GENERATION' || speechGenerationRef.current !== generation) {
          resolveStreamWaiters({ ok: true, interrupted: true });
          return;
        }
        onErrorRef.current(msg);
        setState('ERROR');
        resolveStreamWaiters({ ok: false, error: msg });
      }
    },
    [playSingleAudioBuffer, resolveStreamWaiters, setState, speakWithBrowserFallback, startSpeechCapture]
  );

  const beginSpeechStream = useCallback(() => {
    stopSpeaking();
    stopRecognitionOnly();
    streamProducerDoneRef.current = false;
    streamQueueRef.current = [];
    fallbackGenerationRef.current = -1;
    const gen = speechGenerationRef.current;
    return gen;
  }, [stopRecognitionOnly, stopSpeaking]);

  const enqueueSpeechChunk = useCallback(
    (
      generation: number,
      text: string,
      lang?: string,
      onStart?: (spokenChunk: string) => void,
      emotion?: EmotionalState
    ) => {
      const clean = text.trim();
      if (!clean || speechGenerationRef.current !== generation) return;

      if (emotion) {
        setActiveEmotion(emotion);
      }

      lastSpeechRef.current = lastSpeechRef.current
        ? { text: `${lastSpeechRef.current.text} ${clean}`.trim(), lang: lang || lastSpeechRef.current.lang }
        : { text: clean, lang };
      setHasRetryableSpeech(true);

      const bufferPromise =
        fallbackGenerationRef.current === generation
          ? Promise.reject(new Error('FALLBACK_ACTIVE'))
          : synthesizeChunkBuffer(clean, lang, emotion, generation);
      // Prevent unhandled rejection before runner consumes item
      bufferPromise.catch(() => {});

      streamQueueRef.current.push({
        generation,
        text: clean,
        lang,
        emotion,
        bufferPromise,
        onStart,
      });

      void runStreamPlaybackQueue(generation);
    },
    [runStreamPlaybackQueue, synthesizeChunkBuffer]
  );

  const resetLastSpeechBuffer = useCallback(() => {
    lastSpeechRef.current = null;
  }, []);

  const finishSpeechStream = useCallback(
    async (generation: number, resumeToListeningIfEmpty = false): Promise<SpeakResult> => {
      if (speechGenerationRef.current !== generation) {
        return { ok: true, interrupted: true };
      }
      streamProducerDoneRef.current = true;
      if (!streamRunnerActiveRef.current && streamQueueRef.current.length === 0) {
        if (resumeToListeningIfEmpty && conversationActiveRef.current) {
          setState('WAITING');
          window.setTimeout(() => {
            if (conversationActiveRef.current && stateRef.current === 'WAITING') {
              setState('LISTENING');
              startSpeechCapture();
            }
          }, 160);
        }
        return { ok: true };
      }
      return new Promise<SpeakResult>((resolve) => {
        streamResolversRef.current.push(resolve);
      });
    },
    [setState, startSpeechCapture]
  );

  const speakText = useCallback(
    async (text: string, lang?: string, emotion?: EmotionalState): Promise<SpeakResult> => {
      const cleanText = text.trim();
      if (!cleanText) {
        return { ok: false, error: 'Assistant returned an empty response.' };
      }

      if (emotion) setActiveEmotion(emotion);
      lastSpeechRef.current = { text: cleanText, lang };
      setHasRetryableSpeech(true);

      if (!navigator.onLine) {
        setState('OFFLINE');
        const fallback = await speakWithBrowserFallback(cleanText, lang);
        return fallback.ok
          ? fallback
          : { ok: false, error: 'Offline: cannot reach neural TTS and device fallback failed.' };
      }

      const gen = beginSpeechStream();
      enqueueSpeechChunk(gen, cleanText, lang, undefined, emotion);
      return finishSpeechStream(gen);
    },
    [beginSpeechStream, enqueueSpeechChunk, finishSpeechStream, setState, speakWithBrowserFallback]
  );

  const retryLastSpeech = useCallback(async () => {
    onErrorRef.current(null);
    await unlockAudio();
    if (!lastSpeechRef.current) return;
    await speakText(lastSpeechRef.current.text, lastSpeechRef.current.lang);
  }, [speakText, unlockAudio]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      stopMicHardware();
      if (playbackCtxRef.current && playbackCtxRef.current.state !== 'closed') {
        playbackCtxRef.current.close().catch(() => {});
      }
    };
  }, [stopMicHardware, stopSpeaking]);

  return {
    conversationActive,
    speechSupported,
    micPermissionGranted,
    audioUnlocked,
    interimTranscript,
    inputLevel,
    outputLevel,
    audioBars,
    activeEmotion,
    setActiveEmotion,
    hasRetryableSpeech,
    unlockAudio,
    startConversation,
    endConversation,
    commitCurrentSpeech,
    speakText,
    beginSpeechStream,
    enqueueSpeechChunk,
    finishSpeechStream,
    resetLastSpeechBuffer,
    stopSpeaking,
    retryLastSpeech,
  };
}
