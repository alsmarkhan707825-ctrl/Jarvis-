import {
  AlarmClock,
  Bluetooth,
  Camera,
  ChevronLeft,
  Circle,
  Globe,
  Instagram,
  MessageSquare,
  Phone,
  Search,
  Settings,
  Square,
  Volume2,
  Wifi,
  Youtube,
} from 'lucide-react';
import type { VirtualDeviceState } from '../types/alsmar';

interface VirtualPhonePanelProps {
  device: VirtualDeviceState;
  onQuickTapApp: (appName: string) => void;
  onQuickNav: (nav: 'back' | 'home' | 'recents') => void;
}

export function VirtualPhonePanel({ device, onQuickTapApp, onQuickNav }: VirtualPhonePanelProps) {
  return (
    <div className="glass-panel rounded-2xl p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Android Target Viewport</h3>
          <p className="text-xs text-slate-400">
            Active: {device.screenTitle} · Vol {device.volumePercent}%
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-300 font-mono tabular-nums">
          <span className="inline-flex items-center gap-1">
            <Wifi className={`w-3.5 h-3.5 ${device.wifiEnabled ? 'text-[#F0C95C]' : 'text-slate-600'}`} />
            {device.wifiEnabled ? 'ON' : 'OFF'}
          </span>
          <span className="inline-flex items-center gap-1">
            <Bluetooth className={`w-3.5 h-3.5 ${device.bluetoothEnabled ? 'text-blue-400' : 'text-slate-600'}`} />
            {device.bluetoothEnabled ? 'ON' : 'OFF'}
          </span>
          <span className="inline-flex items-center gap-1">
            <Volume2 className="w-3.5 h-3.5 text-slate-300" />
            {device.volumePercent}%
          </span>
        </div>
      </div>

      {/* Android Frame */}
      <div className="mx-auto w-full max-w-[320px] rounded-[28px] border border-white/15 bg-[#030612] overflow-hidden shadow-2xl">
        {/* Status Bar */}
        <div className="px-5 py-2.5 flex items-center justify-between text-[11px] font-mono text-slate-300 border-b border-white/5 bg-[#060B1E]">
          <span>AL-SMAR OS</span>
          <span>{device.activeAlarm ? `Alarm ${device.activeAlarm}` : '5G · 94%'}</span>
        </div>

        {/* App Viewport */}
        <div className="p-4 min-h-[290px] flex flex-col justify-between bg-gradient-to-b from-[#060D24] to-[#040712]">
          {device.activeApp === 'launcher' && (
            <div className="grid grid-cols-4 gap-3 pt-2">
              {[
                { id: 'instagram', label: 'Instagram', icon: Instagram },
                { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
                { id: 'youtube', label: 'YouTube', icon: Youtube },
                { id: 'chrome', label: 'Chrome', icon: Globe },
                { id: 'camera', label: 'Camera', icon: Camera },
                { id: 'settings', label: 'Settings', icon: Settings },
                { id: 'dialer', label: 'Phone', icon: Phone },
                { id: 'clock', label: 'Clock', icon: AlarmClock },
              ].map((app) => {
                const Icon = app.icon;
                return (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => onQuickTapApp(app.label)}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#0D1A42] border border-[#D4AF37]/30 flex items-center justify-center text-[#F0C95C]">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] text-slate-300 truncate max-w-full">{app.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {device.activeApp === 'instagram' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">Instagram</span>
                <span className="text-xs text-slate-400">{device.instagram.screen}</span>
              </div>
              {device.instagram.screen === 'feed' && (
                <div className="space-y-2.5">
                  <div className="h-24 rounded-xl bg-[#0C1636] border border-white/10 p-3 flex flex-col justify-end">
                    <span className="text-xs text-slate-300">Feed · Scroll offset {device.scrollOffset}px</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-400">
                    <Search className="w-3.5 h-3.5 text-[#F0C95C]" />
                    <span>Search bar node ready</span>
                  </div>
                </div>
              )}
              {device.instagram.screen === 'search' && (
                <div className="px-3 py-2.5 rounded-lg bg-[#0D1A42] border border-[#D4AF37]/40 text-xs text-white flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-[#F0C95C]" />
                  <span>{device.instagram.searchQuery || 'Search input focused...'}</span>
                </div>
              )}
              {device.instagram.screen === 'results' && (
                <div className="space-y-2">
                  <div className="px-3 py-2 rounded-lg bg-white/5 text-xs text-slate-300">
                    Query: {device.instagram.searchQuery}
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#0D1A42] border border-[#D4AF37]/40 text-xs text-white">
                    1. {device.instagram.searchQuery || 'Alsmar'} (Official Profile)
                  </div>
                </div>
              )}
              {device.instagram.screen === 'profile' && (
                <div className="p-3 rounded-xl bg-[#0B1535] border border-[#D4AF37]/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        @{ (device.instagram.selectedProfile || 'alsmar').toLowerCase() }
                      </p>
                      <p className="text-xs text-slate-400">Verified Technology Creator</p>
                    </div>
                    <span className="text-xs font-medium px-2.5 py-1 rounded bg-[#D4AF37] text-[#050814]">
                      {device.instagram.followingAlsmar ? 'Following' : 'Follow'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">Profile screen verified via Accessibility node tree.</p>
                </div>
              )}
            </div>
          )}

          {device.activeApp === 'whatsapp' && (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-white">WhatsApp</div>
              {device.whatsapp.screen === 'chats' ? (
                <div className="space-y-2 text-xs">
                  {['Ali', 'Papa', 'Engineering Team'].map((c) => (
                    <div key={c} className="p-2.5 rounded-lg bg-white/5 border border-white/10 text-slate-200">
                      {c}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2.5 text-xs">
                  <div className="p-2 rounded-lg bg-[#0C1738] text-slate-200">
                    Recipient: {device.whatsapp.recipient || 'Ali'}
                  </div>
                  {device.whatsapp.draftMessage && (
                    <div className="p-2.5 rounded-lg bg-[#162756] border border-[#D4AF37]/30 text-white">
                      Draft: {device.whatsapp.draftMessage}
                    </div>
                  )}
                  {device.whatsapp.sentMessages.slice(-2).map((m, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-200">
                      Sent to {m.to}: “{m.body}” ({m.time})
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {device.activeApp === 'youtube' && (
            <div className="space-y-3 text-xs">
              <div className="text-sm font-semibold text-white">YouTube</div>
              <div className="p-3 rounded-xl bg-[#0D1A42] border border-white/10 space-y-1.5">
                <div className="text-slate-400">
                  Mode: {device.youtube.screen} {device.youtube.fullscreen ? '· Fullscreen' : ''}
                </div>
                {device.youtube.searchQuery && (
                  <div className="text-white">Search: {device.youtube.searchQuery}</div>
                )}
                {device.youtube.playingTitle && (
                  <div className="text-[#F0C95C] font-medium">Playing: {device.youtube.playingTitle}</div>
                )}
              </div>
            </div>
          )}

          {device.activeApp === 'chrome' && (
            <div className="space-y-3 text-xs">
              <div className="text-sm font-semibold text-white">Chrome</div>
              <div className="px-2.5 py-1.5 rounded bg-white/5 border border-white/10 font-mono text-[11px] text-slate-300 truncate">
                {device.chrome.url}
              </div>
              <div className="p-3 rounded-xl bg-[#0D1A42] border border-[#D4AF37]/30 text-slate-200">
                {device.chrome.resultSummary}
              </div>
            </div>
          )}

          {device.activeApp === 'camera' && (
            <div className="space-y-3 text-xs">
              <div className="text-sm font-semibold text-white">Camera</div>
              <div className="h-32 rounded-xl bg-[#0D1A42] border border-[#D4AF37]/30 flex flex-col items-center justify-center gap-1">
                <Camera className="w-7 h-7 text-[#F0C95C]" />
                <span className="text-slate-200">Photos captured: {device.camera.shutterCount}</span>
                {device.camera.lastPhotoTimestamp && (
                  <span className="text-slate-400">Last: {device.camera.lastPhotoTimestamp}</span>
                )}
              </div>
            </div>
          )}

          {device.activeApp === 'settings' && (
            <div className="space-y-2 text-xs">
              <div className="text-sm font-semibold text-white">
                Settings · {device.settingsSubpage.toUpperCase()}
              </div>
              <div className="p-2.5 rounded-lg bg-white/5 flex justify-between text-slate-200">
                <span>Wi-Fi / Bluetooth</span>
                <span className="font-mono text-[#F0C95C]">
                  {device.wifiEnabled ? 'Wi-Fi ON' : 'Wi-Fi OFF'} · {device.bluetoothEnabled ? 'BT ON' : 'BT OFF'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-white/5 flex justify-between text-slate-200">
                <span>Brightness / Volume</span>
                <span className="font-mono text-[#F0C95C]">
                  {device.brightnessPercent}% · {device.volumePercent}%
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-white/5 flex justify-between text-slate-200">
                <span>Do Not Disturb</span>
                <span className="font-mono text-[#F0C95C]">{device.dndEnabled ? 'ON' : 'OFF'}</span>
              </div>
            </div>
          )}

          {device.activeApp === 'dialer' && (
            <div className="space-y-2 text-xs">
              <div className="text-sm font-semibold text-white">Phone & Call Guardian</div>
              <div className="p-3 rounded-xl bg-[#0D1A42] border border-[#D4AF37]/40 text-slate-200 space-y-1">
                <div>
                  {device.dialer.lastDialedContact
                    ? `${device.dialer.lastDialedContact} · ${device.dialer.callState.toUpperCase()}`
                    : `Dialer ${device.dialer.callState}`}
                </div>
                <div className="font-mono text-[11px] text-[#F0C95C]">
                  Speakerphone: {device.dialer.speakerOn ? 'ON' : 'OFF'}
                </div>
                {device.dialer.guardianSummary && (
                  <div className="text-[11px] text-emerald-300 pt-1">
                    Call Guardian: {device.dialer.guardianSummary}
                  </div>
                )}
              </div>
            </div>
          )}

          {device.activeApp === 'clock' && (
            <div className="space-y-2 text-xs">
              <div className="text-sm font-semibold text-white">Clock & Alarms</div>
              <div className="p-3 rounded-xl bg-[#0D1A42] border border-[#D4AF37]/40 text-[#F0C95C] font-mono">
                {device.activeAlarm ? `Alarm active at ${device.activeAlarm}` : 'No alarms scheduled'}
              </div>
            </div>
          )}

          {device.activeApp === 'recents' && (
            <div className="space-y-2 text-xs">
              <div className="text-sm font-semibold text-white">Recent Apps</div>
              <div className="grid grid-cols-2 gap-2">
                {['Instagram', 'WhatsApp', 'YouTube', 'Chrome'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => onQuickTapApp(r)}
                    className="p-3 rounded-lg bg-[#0D1A42] border border-white/10 text-left text-slate-200 hover:border-[#D4AF37]/40 cursor-pointer"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Accessibility Node Preview */}
          <div className="pt-3 border-t border-white/10 text-[11px] text-slate-400">
            <span className="text-slate-500">UI Nodes: </span>
            <span className="text-slate-300">{device.visibleNodes.slice(0, 4).join(' · ')}</span>
          </div>
        </div>

        {/* Android System Nav Bar */}
        <div className="px-8 py-2.5 bg-[#050814] border-t border-white/10 flex items-center justify-between text-slate-400">
          <button
            type="button"
            onClick={() => onQuickNav('back')}
            aria-label="Android Back"
            className="p-1.5 hover:text-[#F0C95C] cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onQuickNav('home')}
            aria-label="Android Home"
            className="p-1.5 hover:text-[#F0C95C] cursor-pointer"
          >
            <Circle className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onQuickNav('recents')}
            aria-label="Android Recents"
            className="p-1.5 hover:text-[#F0C95C] cursor-pointer"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
