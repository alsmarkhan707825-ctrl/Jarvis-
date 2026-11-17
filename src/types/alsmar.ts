export type AssistantState =
  | 'IDLE'
  | 'LISTENING'
  | 'PROCESSING'
  | 'THINKING'
  | 'SPEAKING'
  | 'WAITING'
  | 'EXECUTING'
  | 'ERROR'
  | 'OFFLINE';

export type EmotionalState =
  | 'normal'
  | 'happy'
  | 'laughing'
  | 'sad'
  | 'angry'
  | 'curious'
  | 'surprised'
  | 'caring'
  | 'serious'
  | 'thinking';

export interface FlightTelemetry {
  altitudeFt: number;
  airspeedKts: number;
  headingDeg: number;
  waypointLabel: string;
}

export type ScreenId = 'home' | 'chat' | 'voice' | 'history' | 'settings';

export type SupportedLanguage = 'auto' | 'en' | 'hi' | 'hinglish' | 'ur';
export type ProviderId = 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'custom';
export type TaskCapability = 'reasoning' | 'vision' | 'coding' | 'tools' | 'search' | 'low-latency-voice';
export type RouterMode = 'smart-auto' | 'manual';

export type NeuralVoiceId = 'Charon' | 'Fenrir' | 'Puck' | 'Kore' | 'Zephyr';
export type VoiceGender = 'male' | 'female';

export interface NeuralVoiceOption {
  id: NeuralVoiceId;
  label: string;
  gender: VoiceGender;
  tone: string;
}

export interface AIModelConfig {
  id: string;
  provider: ProviderId;
  providerLabel: string;
  modelName: string;
  displayName: string;
  description: string;
  capabilities: TaskCapability[];
  estimatedCostPer1kTokensUsd: number;
  avgSpeedTier: 'ultra-fast' | 'fast' | 'balanced';
  isDefault: boolean;
  priority: number;
  lastLatencyMs: number | null;
  totalRequests: number;
  estimatedSpendUsd: number;
  status: 'untested' | 'ready' | 'unavailable' | 'unconfigured';
  statusMessage?: string;
}

export interface ProviderEnvironmentStatus {
  gemini: boolean;
  openai: boolean;
  anthropic: boolean;
  openrouter: boolean;
  custom: boolean;
  customBaseUrl: string;
}

export type ActionType =
  | 'LAUNCH_APP'
  | 'WAIT_FOR_IDLE'
  | 'DETECT_UI'
  | 'CLICK_NODE'
  | 'LONG_PRESS'
  | 'INPUT_TEXT'
  | 'WAIT_FOR_RESULTS'
  | 'SELECT_MATCH'
  | 'SCROLL'
  | 'SWIPE'
  | 'NAVIGATE_BACK'
  | 'NAVIGATE_HOME'
  | 'OPEN_RECENTS'
  | 'TOGGLE_RADIO'
  | 'SET_VOLUME'
  | 'SET_BRIGHTNESS'
  | 'SET_ALARM'
  | 'CAMERA_CAPTURE'
  | 'PREPARE_MESSAGE'
  | 'SEND_MESSAGE'
  | 'DIAL_CALL'
  | 'ANSWER_CALL'
  | 'HOLD_CALL'
  | 'HANG_UP_CALL'
  | 'TOGGLE_SPEAKERPHONE'
  | 'CALL_GUARDIAN_REPLY'
  | 'RUN_ROUTINE'
  | 'READ_SCREEN'
  | 'VERIFY_STATE'
  | 'SPEAK_RESULT';

export interface PlannedActionStep {
  stepNumber: number;
  actionType: ActionType;
  targetApp?: string;
  targetNodeText?: string;
  inputText?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
  numericValue?: number;
  description: string;
  verificationCriteria: string;
  requiresConfirmation?: boolean;
  status?: 'pending' | 'running' | 'verified' | 'retried' | 'failed' | 'skipped';
  durationMs?: number;
  errorDetail?: string;
}

export interface AIPlanResponse {
  detectedLanguage: 'en' | 'hi' | 'hinglish' | 'ur';
  intentSummary: string;
  classifiedCapability: TaskCapability;
  routingReason: string;
  isAmbiguous: boolean;
  clarificationQuestion?: string;
  requiresConfirmation: boolean;
  sensitiveReason?: string;
  spokenResponse: string;
  steps: PlannedActionStep[];
  providerUsed: ProviderId;
  modelUsed: string;
  latencyMs: number;
  fallbackTriggered: boolean;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  language?: string;
  emotion?: EmotionalState;
  timestamp: string;
  modelUsed?: string;
  latencyMs?: number;
  voiceUsed?: string;
}

export interface AutomationRunLog {
  id: string;
  command: string;
  detectedLanguage: string;
  intentSummary: string;
  status: 'verified' | 'cancelled' | 'failed' | 'awaiting_confirmation';
  providerUsed: string;
  modelUsed: string;
  latencyMs: number;
  timestamp: string;
  steps: PlannedActionStep[];
  spokenResult: string;
}

export interface VoiceSettingsConfig {
  continuousListening: boolean;
  wakeWordEnabled: boolean;
  wakeWordPhrase: string;
  preferredLanguage: SupportedLanguage;
  preferredGender: VoiceGender;
  neuralVoice: NeuralVoiceId;
  vadSilenceMs: number;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  speechRate: number;
  bargeInEnabled: boolean;
  strictTurnTaking: boolean;
  privacySandboxEnabled: boolean;
}

export interface AndroidPermissionItem {
  id: string;
  name: string;
  androidManifestPermission: string;
  category: 'runtime' | 'special' | 'service';
  requiredFor: string;
  rationale: string;
  androidRestrictionNote: string;
  settingsAction: string;
  enabled: boolean;
  browserTestable?: 'microphone' | 'camera' | 'notifications';
}

export type AndroidScreenApp =
  | 'launcher'
  | 'instagram'
  | 'whatsapp'
  | 'youtube'
  | 'chrome'
  | 'camera'
  | 'settings'
  | 'dialer'
  | 'clock'
  | 'recents';

export interface VirtualDeviceState {
  activeApp: AndroidScreenApp;
  previousApp: AndroidScreenApp;
  screenTitle: string;
  visibleNodes: string[];
  scrollOffset: number;
  wifiEnabled: boolean;
  bluetoothEnabled: boolean;
  dndEnabled: boolean;
  volumePercent: number;
  brightnessPercent: number;
  activeAlarm: string | null;
  activeTimerMinutes: number | null;
  lastScreenSummary: string | null;
  lastRoutineRun: string | null;
  instagram: {
    screen: 'feed' | 'search' | 'results' | 'profile';
    searchQuery: string;
    selectedProfile: string | null;
    followingAlsmar: boolean;
  };
  whatsapp: {
    screen: 'chats' | 'compose';
    recipient: string;
    draftMessage: string;
    sentMessages: Array<{ to: string; body: string; time: string }>;
  };
  youtube: {
    screen: 'home' | 'results' | 'player';
    searchQuery: string;
    playingTitle: string | null;
    fullscreen: boolean;
  };
  chrome: {
    url: string;
    searchQuery: string;
    resultSummary: string;
  };
  camera: {
    lastPhotoTimestamp: string | null;
    shutterCount: number;
  };
  dialer: {
    lastDialedContact: string | null;
    callState: 'idle' | 'ringing' | 'active' | 'on_hold' | 'guardian' | 'ended';
    speakerOn: boolean;
    guardianSummary: string | null;
  };
  settingsSubpage: 'main' | 'wifi' | 'bluetooth';
}

export interface MemoryRecord {
  id: string;
  category: 'preference' | 'fact' | 'routine' | 'study' | 'contact-note';
  title: string;
  content: string;
  createdAt: string;
  approvedByUser: boolean;
}

export interface AndroidSourceFile {
  path: string;
  module: string;
  summary: string;
  content: string;
}
