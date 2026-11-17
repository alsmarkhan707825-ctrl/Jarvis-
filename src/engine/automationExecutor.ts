import type {
  AndroidScreenApp,
  PlannedActionStep,
  VirtualDeviceState,
} from '../types/alsmar';
import { sanitizeWithPrivacySandbox } from '../utils/privacySandbox';

function cloneDevice(state: VirtualDeviceState): VirtualDeviceState {
  return JSON.parse(JSON.stringify(state)) as VirtualDeviceState;
}

function resolveAppName(raw?: string): AndroidScreenApp {
  const s = (raw || '').toLowerCase();
  if (s.includes('insta')) return 'instagram';
  if (s.includes('whats')) return 'whatsapp';
  if (s.includes('you')) return 'youtube';
  if (s.includes('chrome') || s.includes('browser') || s.includes('google')) return 'chrome';
  if (s.includes('cam')) return 'camera';
  if (s.includes('set')) return 'settings';
  if (s.includes('phone') || s.includes('dial') || s.includes('call')) return 'dialer';
  if (s.includes('clock') || s.includes('alarm')) return 'clock';
  return 'launcher';
}

function getNodesForState(state: VirtualDeviceState): string[] {
  switch (state.activeApp) {
    case 'launcher':
      return ['Instagram', 'WhatsApp', 'YouTube', 'Chrome', 'Camera', 'Settings', 'Phone', 'Clock'];
    case 'instagram':
      if (state.instagram.screen === 'feed') return ['Home', 'Search', 'Reels', 'Profile', 'Feed Post 1'];
      if (state.instagram.screen === 'search') return ['Search input', 'Recent searches', 'Back'];
      if (state.instagram.screen === 'results') {
        const q = state.instagram.searchQuery || 'Alsmar';
        return [`${q} (Official Account)`, `${q} Tech Lab`, 'Accounts Tab', 'Back'];
      }
      return [
        state.instagram.selectedProfile || 'Alsmar',
        state.instagram.followingAlsmar ? 'Following' : 'Follow',
        'Message',
        'Posts Grid',
        'Back',
      ];
    case 'whatsapp':
      if (state.whatsapp.screen === 'chats') return ['Search Chats', 'Ali', 'Papa', 'Tech Group', 'New Chat'];
      return [`Chat: ${state.whatsapp.recipient || 'Contact'}`, 'Message Input', 'Send Button', 'Back'];
    case 'youtube':
      if (state.youtube.screen === 'home') return ['Search YouTube', 'Home', 'Shorts', 'Subscriptions'];
      if (state.youtube.screen === 'results') {
        const q = state.youtube.searchQuery || 'Latest Technology';
        return [`Play: ${q} — Full Overview`, `${q} Breakdown`, 'Filter', 'Back'];
      }
      return [
        `Now Playing: ${state.youtube.playingTitle}`,
        state.youtube.fullscreen ? 'Exit Fullscreen' : 'Fullscreen',
        'Pause',
        'Next',
        'Back',
      ];
    case 'chrome':
      return ['Address / Search Bar', state.chrome.url, state.chrome.resultSummary, 'Tabs', 'Back'];
    case 'camera':
      return ['Photo Mode', 'Take Photo', 'Switch Camera', `Saved Photos: ${state.camera.shutterCount}`];
    case 'settings':
      if (state.settingsSubpage === 'wifi') {
        return [`Wi-Fi Toggle (${state.wifiEnabled ? 'ON' : 'OFF'})`, 'Alsmar-5G Connected', 'Back'];
      }
      if (state.settingsSubpage === 'bluetooth') {
        return [`Bluetooth Toggle (${state.bluetoothEnabled ? 'ON' : 'OFF'})`, 'Paired Devices', 'Back'];
      }
      return [
        'Wi-Fi Settings',
        'Bluetooth Settings',
        `DND (${state.dndEnabled ? 'ON' : 'OFF'})`,
        `Brightness ${state.brightnessPercent}%`,
        `Volume ${state.volumePercent}%`,
      ];
    case 'dialer':
      return [
        'Keypad',
        `Speaker (${state.dialer.speakerOn ? 'ON' : 'OFF'})`,
        `Call State: ${state.dialer.callState}`,
        `Contact: ${state.dialer.lastDialedContact || 'None'}`,
      ];
    case 'clock':
      return ['Alarm', 'Timer', `Active Alarm: ${state.activeAlarm || 'None'}`];
    case 'recents':
      return ['Instagram', 'WhatsApp', 'Chrome', 'Clear All'];
  }
}

export function applyDeviceStep(
  current: VirtualDeviceState,
  step: PlannedActionStep
): { nextState: VirtualDeviceState; ok: boolean; errorDetail?: string; readOutput?: string } {
  const next = cloneDevice(current);

  switch (step.actionType) {
    case 'LAUNCH_APP': {
      const target = resolveAppName(step.targetApp || step.targetNodeText);
      next.previousApp = current.activeApp;
      next.activeApp = target;
      next.scrollOffset = 0;
      if (target === 'instagram') next.instagram.screen = 'feed';
      if (target === 'whatsapp') next.whatsapp.screen = 'chats';
      if (target === 'youtube') {
        next.youtube.screen = 'home';
        next.youtube.fullscreen = false;
      }
      if (target === 'settings') next.settingsSubpage = 'main';
      next.screenTitle = target.charAt(0).toUpperCase() + target.slice(1);
      next.visibleNodes = getNodesForState(next);
      return { nextState: next, ok: true };
    }

    case 'WAIT_FOR_IDLE':
    case 'WAIT_FOR_RESULTS':
    case 'DETECT_UI': {
      next.visibleNodes = getNodesForState(next);
      return { nextState: next, ok: true };
    }

    case 'CLICK_NODE':
    case 'SELECT_MATCH':
    case 'LONG_PRESS': {
      const q = (step.targetNodeText || '').toLowerCase();
      if (next.activeApp === 'instagram') {
        if (q.includes('search')) {
          next.instagram.screen = 'search';
          next.screenTitle = 'Instagram · Search';
        } else if (q.includes('follow')) {
          next.instagram.followingAlsmar = true;
          next.screenTitle = `Instagram · Following ${next.instagram.selectedProfile || 'Alsmar'}`;
        } else if (
          next.instagram.screen === 'results' ||
          q.includes('alsmar') ||
          q.includes('first') ||
          q.includes('profile') ||
          q.includes('account')
        ) {
          next.instagram.screen = 'profile';
          next.instagram.selectedProfile = next.instagram.searchQuery || 'Alsmar';
          next.screenTitle = `Instagram · @${(next.instagram.selectedProfile || 'alsmar').toLowerCase()}`;
        }
      } else if (next.activeApp === 'settings') {
        if (q.includes('wi-fi') || q.includes('wifi')) {
          next.settingsSubpage = 'wifi';
          next.screenTitle = 'Settings · Wi-Fi';
        } else if (q.includes('bluetooth')) {
          next.settingsSubpage = 'bluetooth';
          next.screenTitle = 'Settings · Bluetooth';
        }
      } else if (next.activeApp === 'youtube') {
        if (q.includes('full')) {
          next.youtube.screen = 'player';
          next.youtube.fullscreen = true;
          next.screenTitle = 'YouTube · Fullscreen Player';
        } else if (q.includes('search')) {
          next.youtube.screen = 'results';
          next.screenTitle = 'YouTube · Search';
        } else if (next.youtube.screen === 'results' || q.includes('play') || q.includes('first') || q.includes('video')) {
          next.youtube.screen = 'player';
          next.youtube.playingTitle = next.youtube.searchQuery || 'Lo-Fi Chill Focus Mix';
          next.youtube.fullscreen = true;
          next.screenTitle = 'YouTube · Fullscreen Player';
        }
      } else if (next.activeApp === 'whatsapp') {
        if (q.includes('ali') || q.includes('papa')) {
          next.whatsapp.screen = 'compose';
          next.whatsapp.recipient = q.includes('papa') ? 'Papa' : 'Ali';
          next.screenTitle = `WhatsApp · ${next.whatsapp.recipient}`;
        }
      } else if (next.activeApp === 'camera') {
        next.camera.shutterCount += 1;
        next.camera.lastPhotoTimestamp = new Date().toLocaleTimeString();
        next.screenTitle = 'Camera · Photo Captured';
      } else if (next.activeApp === 'launcher') {
        const app = resolveAppName(q);
        if (app !== 'launcher') {
          next.previousApp = 'launcher';
          next.activeApp = app;
          next.screenTitle = app.charAt(0).toUpperCase() + app.slice(1);
        }
      }
      next.visibleNodes = getNodesForState(next);
      return { nextState: next, ok: true };
    }

    case 'INPUT_TEXT': {
      const text = sanitizeWithPrivacySandbox(step.inputText || '').sanitizedText;
      if (next.activeApp === 'instagram') {
        next.instagram.searchQuery = text;
        next.instagram.screen = 'results';
        next.screenTitle = `Instagram · Results for "${text}"`;
      } else if (next.activeApp === 'youtube') {
        next.youtube.searchQuery = text;
        next.youtube.screen = 'results';
        next.screenTitle = `YouTube · Results for "${text}"`;
      } else if (next.activeApp === 'chrome') {
        next.chrome.searchQuery = text;
        next.chrome.url = `https://www.google.com/search?q=${encodeURIComponent(text)}`;
        if (text.toLowerCase().includes('weather') && text.toLowerCase().includes('delhi')) {
          next.chrome.resultSummary = 'New Delhi Weather: 24°C, Clear Sky, Humidity 41%, Wind 9 km/h.';
        } else {
          next.chrome.resultSummary = `Search results loaded for "${text}".`;
        }
        next.screenTitle = `Chrome · ${text}`;
      } else if (next.activeApp === 'whatsapp') {
        next.whatsapp.screen = 'compose';
        next.whatsapp.draftMessage = text;
        next.screenTitle = 'WhatsApp · Draft ready';
      }
      next.visibleNodes = getNodesForState(next);
      return { nextState: next, ok: true };
    }

    case 'SCROLL':
    case 'SWIPE': {
      const dir = step.direction || 'down';
      const delta = dir === 'up' || dir === 'left' ? -180 : 180;
      next.scrollOffset = Math.max(0, next.scrollOffset + delta);
      next.screenTitle = `${next.activeApp.charAt(0).toUpperCase() + next.activeApp.slice(1)} · Swiped ${dir}`;
      next.visibleNodes = getNodesForState(next);
      return { nextState: next, ok: true };
    }

    case 'NAVIGATE_BACK': {
      if (next.activeApp === 'instagram' && next.instagram.screen !== 'feed') {
        next.instagram.screen =
          next.instagram.screen === 'profile'
            ? 'results'
            : next.instagram.screen === 'results'
              ? 'search'
              : 'feed';
      } else if (next.activeApp === 'settings' && next.settingsSubpage !== 'main') {
        next.settingsSubpage = 'main';
      } else {
        next.activeApp = next.previousApp || 'launcher';
      }
      next.screenTitle = `${next.activeApp.charAt(0).toUpperCase() + next.activeApp.slice(1)}`;
      next.visibleNodes = getNodesForState(next);
      return { nextState: next, ok: true };
    }

    case 'NAVIGATE_HOME': {
      next.previousApp = current.activeApp;
      next.activeApp = 'launcher';
      next.screenTitle = 'Android Home';
      next.visibleNodes = getNodesForState(next);
      return { nextState: next, ok: true };
    }

    case 'OPEN_RECENTS': {
      next.previousApp = current.activeApp;
      next.activeApp = 'recents';
      next.screenTitle = 'Recent Apps';
      next.visibleNodes = getNodesForState(next);
      return { nextState: next, ok: true };
    }

    case 'TOGGLE_RADIO': {
      const radio = (step.targetNodeText || '').toLowerCase();
      const enable = (step.inputText || 'on').toLowerCase() !== 'off';
      if (radio.includes('wifi') || radio.includes('wi-fi')) {
        next.wifiEnabled = enable;
      } else if (radio.includes('blue')) {
        next.bluetoothEnabled = enable;
      } else if (radio.includes('dnd') || radio.includes('disturb')) {
        next.dndEnabled = enable;
      }
      next.visibleNodes = getNodesForState(next);
      return { nextState: next, ok: true };
    }

    case 'SET_VOLUME': {
      const val = typeof step.numericValue === 'number' ? step.numericValue : parseInt(step.inputText || '50', 10);
      next.volumePercent = Math.min(100, Math.max(0, Number.isNaN(val) ? 50 : val));
      next.visibleNodes = getNodesForState(next);
      return { nextState: next, ok: true };
    }

    case 'SET_BRIGHTNESS': {
      const val = typeof step.numericValue === 'number' ? step.numericValue : parseInt(step.inputText || '70', 10);
      next.brightnessPercent = Math.min(100, Math.max(10, Number.isNaN(val) ? 70 : val));
      next.visibleNodes = getNodesForState(next);
      return { nextState: next, ok: true };
    }

    case 'SET_ALARM': {
      next.previousApp = current.activeApp;
      next.activeApp = 'clock';
      next.activeAlarm = step.inputText || '06:00 AM';
      next.screenTitle = `Clock · Alarm ${next.activeAlarm}`;
      next.visibleNodes = getNodesForState(next);
      return { nextState: next, ok: true };
    }

    case 'CAMERA_CAPTURE': {
      next.previousApp = current.activeApp;
      next.activeApp = 'camera';
      next.camera.shutterCount += 1;
      next.camera.lastPhotoTimestamp = new Date().toLocaleTimeString();
      next.screenTitle = 'Camera · Photo Saved';
      next.visibleNodes = getNodesForState(next);
      return { nextState: next, ok: true };
    }

    case 'PREPARE_MESSAGE': {
      next.previousApp = current.activeApp;
      next.activeApp = 'whatsapp';
      next.whatsapp.screen = 'compose';
      next.whatsapp.recipient = step.targetNodeText || 'Ali';
      next.whatsapp.draftMessage = sanitizeWithPrivacySandbox(step.inputText || '').sanitizedText;
      next.screenTitle = `WhatsApp · Draft for ${next.whatsapp.recipient}`;
      next.visibleNodes = getNodesForState(next);
      return { nextState: next, ok: true };
    }

    case 'SEND_MESSAGE': {
      next.previousApp = current.activeApp;
      next.activeApp = 'whatsapp';
      next.whatsapp.screen = 'compose';
      const to = step.targetNodeText || next.whatsapp.recipient || 'Ali';
      const rawBody = step.inputText || next.whatsapp.draftMessage || 'Hello';
      const body = sanitizeWithPrivacySandbox(rawBody).sanitizedText;
      next.whatsapp.recipient = to;
      next.whatsapp.draftMessage = '';
      next.whatsapp.sentMessages.push({ to, body, time: new Date().toLocaleTimeString() });
      next.screenTitle = `WhatsApp · Sent to ${to}`;
      next.visibleNodes = getNodesForState(next);
      return { nextState: next, ok: true };
    }

    case 'DIAL_CALL': {
      next.previousApp = current.activeApp;
      next.activeApp = 'dialer';
      next.dialer.lastDialedContact = step.targetNodeText || 'Papa';
      next.dialer.callState = 'active';
      const speakerHint = (step.inputText || step.description || '').toLowerCase().includes('speaker');
      if (speakerHint) next.dialer.speakerOn = true;
      next.screenTitle = `Dialer · Calling ${next.dialer.lastDialedContact}${next.dialer.speakerOn ? ' (Speaker)' : ''}`;
      next.visibleNodes = getNodesForState(next);
      return { nextState: next, ok: true };
    }

    case 'TOGGLE_SPEAKERPHONE': {
      next.activeApp = 'dialer';
      next.dialer.speakerOn = (step.inputText || 'on').toLowerCase() !== 'off';
      next.screenTitle = `Dialer · Speaker ${next.dialer.speakerOn ? 'ON' : 'OFF'}`;
      next.visibleNodes = getNodesForState(next);
      return { nextState: next, ok: true };
    }

    case 'ANSWER_CALL': {
      next.activeApp = 'dialer';
      next.dialer.callState = 'active';
      next.screenTitle = `Dialer · Connected (${next.dialer.lastDialedContact || 'Incoming Caller'})`;
      next.visibleNodes = getNodesForState(next);
      return { nextState: next, ok: true };
    }

    case 'HOLD_CALL': {
      next.activeApp = 'dialer';
      next.dialer.callState = 'on_hold';
      next.screenTitle = `Dialer · Call On Hold`;
      next.visibleNodes = getNodesForState(next);
      return { nextState: next, ok: true };
    }

    case 'HANG_UP_CALL': {
      next.activeApp = 'dialer';
      next.dialer.callState = 'ended';
      next.dialer.speakerOn = false;
      next.screenTitle = 'Dialer · Call Ended';
      next.visibleNodes = getNodesForState(next);
      return { nextState: next, ok: true };
    }

    case 'CALL_GUARDIAN_REPLY': {
      next.activeApp = 'dialer';
      next.dialer.callState = 'guardian';
      const scrubbed = sanitizeWithPrivacySandbox(
        step.inputText || 'Hello, my user is unavailable. I can take a message without sharing private details.'
      );
      next.dialer.guardianSummary = scrubbed.hasSensitiveData
        ? `${scrubbed.sanitizedText} [Privacy Sandbox blocked: ${scrubbed.blockedCategories.join(', ')}]`
        : scrubbed.sanitizedText;
      next.screenTitle = 'Dialer · AI Call Guardian Active';
      next.visibleNodes = getNodesForState(next);
      return { nextState: next, ok: true };
    }

    case 'RUN_ROUTINE': {
      const name = (step.targetNodeText || step.inputText || 'Morning Routine').toLowerCase();
      if (name.includes('night')) {
        next.dndEnabled = true;
        next.brightnessPercent = 25;
        next.volumePercent = 30;
        next.activeAlarm = '06:30 AM';
        next.lastRoutineRun = 'Night Briefing (DND ON, Brightness 25%, Alarm 06:30 AM)';
      } else {
        next.dndEnabled = false;
        next.brightnessPercent = 80;
        next.wifiEnabled = true;
        next.activeApp = 'youtube';
        next.youtube.screen = 'player';
        next.youtube.playingTitle = 'Lo-Fi Chill Focus Mix';
        next.youtube.fullscreen = true;
        next.lastRoutineRun = 'Morning Briefing (DND OFF, Weather Checked, Lo-Fi Mix Playing)';
      }
      next.screenTitle = `Routine · ${next.lastRoutineRun}`;
      next.visibleNodes = getNodesForState(next);
      return { nextState: next, ok: true };
    }

    case 'READ_SCREEN': {
      const nodes = getNodesForState(next);
      next.visibleNodes = nodes;
      const summary = `Active screen is ${next.screenTitle}. Visible elements: ${nodes.join(', ')}.`;
      next.lastScreenSummary = summary;
      return {
        nextState: next,
        ok: true,
        readOutput: summary,
      };
    }

    case 'VERIFY_STATE':
    case 'SPEAK_RESULT': {
      next.visibleNodes = getNodesForState(next);
      return { nextState: next, ok: true };
    }

    default:
      return { nextState: next, ok: false, errorDetail: `Unsupported action type: ${step.actionType}` };
  }
}
