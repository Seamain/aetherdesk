import React, { useState } from 'react';
import { Activity, Cpu, HardDrive, Volume2, VolumeX, Radio, Sparkles, Languages, Lock, LockOpen } from 'lucide-react';
import type { SystemTelemetry } from '../types';
import { useLang, LANG_OPTIONS, type Lang } from '../i18n';
import { getAuthToken, setAuthToken } from '../services/api';

interface NavbarProps {
  telemetry: SystemTelemetry | null;
  wsConnected: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  ambientType: string;
  onChangeAmbient: (type: 'off' | 'white' | 'pink' | 'rain') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  telemetry,
  wsConnected,
  soundEnabled,
  onToggleSound,
  ambientType,
  onChangeAmbient,
}) => {
  const { t, lang, setLang } = useLang();
  const [token, setToken] = useState(() => getAuthToken());
  const authed = token.trim().length > 0;
  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d > 0 ? `${d}d ` : ''}${h}h ${m}m`;
  };

  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-5 flex items-center justify-between">
      {/* Brand & Distro Info */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-indigo-500/20 text-white font-bold">
          <Activity className="w-5 h-5 text-white animate-pulse" />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${wsConnected ? 'bg-emerald-400 opacity-75' : 'bg-rose-400 opacity-75'}`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${wsConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
          </span>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-400 text-lg">
              AETHER<span className="text-white font-semibold">DESK</span>
            </span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-500/30">
              v1.0 Pro
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>{telemetry?.static.hostname || 'localhost'}</span>
            <span className="text-slate-600">•</span>
            <span className="text-cyan-400 font-mono text-[11px]">{telemetry?.static.osName || 'Linux'}</span>
            {telemetry?.static.kernel && (
              <>
                <span className="text-slate-600">•</span>
                <span className="text-slate-500 font-mono text-[10px] truncate max-w-[150px]">{telemetry.static.kernel}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Live HUD Badges */}
      <div className="hidden md:flex items-center gap-4">
        {telemetry && (
          <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 px-3.5 py-1.5 rounded-xl shadow-inner text-xs font-mono">
            {/* CPU */}
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">CPU</span>
              <span className={`font-semibold ${telemetry.cpu.usagePercent > 80 ? 'text-rose-400' : telemetry.cpu.usagePercent > 50 ? 'text-amber-400' : 'text-cyan-300'}`}>
                {telemetry.cpu.usagePercent}%
              </span>
            </div>

            <span className="text-slate-700">|</span>

            {/* RAM */}
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-slate-400">RAM</span>
              <span className="text-purple-300 font-semibold">
                {telemetry.memory.percent}%
              </span>
            </div>

            <span className="text-slate-700">|</span>

            {/* Load Avg */}
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="text-slate-400">Load</span>
              <span className="text-emerald-400">{telemetry.loadavg['1m']}</span>
            </div>

            <span className="text-slate-700">|</span>

            {/* Uptime */}
            <div className="text-slate-400">
              Up: <span className="text-slate-200">{formatUptime(telemetry.uptimeSeconds)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Controls */}
      <div className="flex items-center gap-2.5">
        {/* Ambient Noise Selector */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 ml-1.5 mr-1" />
          <select
            value={ambientType}
            onChange={(e) => onChangeAmbient(e.target.value as any)}
            className="bg-transparent text-slate-300 text-xs focus:outline-none cursor-pointer pr-1"
          >
            <option value="off" className="bg-slate-900 text-slate-300">{t('nav.mute')}</option>
            <option value="white" className="bg-slate-900 text-slate-300">{t('nav.white')}</option>
            <option value="pink" className="bg-slate-900 text-slate-300">{t('nav.pink')}</option>
            <option value="rain" className="bg-slate-900 text-slate-300">{t('nav.rain')}</option>
          </select>
        </div>

        {/* Language Selector (4 locales) */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
          <Languages className="w-3.5 h-3.5 text-cyan-400 ml-1.5 mr-1" />
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            title="Language / 語言"
            className="bg-transparent text-slate-300 text-xs focus:outline-none cursor-pointer pr-1 font-mono"
          >
            {LANG_OPTIONS.map((o) => (
              <option key={o.id} value={o.id} className="bg-slate-900 text-slate-300">{o.label}</option>
            ))}
          </select>
        </div>
        {/* API Token (Bearer auth when server sets AETHER_TOKEN) */}
        <div className="hidden lg:flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs" title="API Token: required only if server sets AETHER_TOKEN">
          {authed ? <Lock className="w-3.5 h-3.5 text-emerald-400 ml-1.5 mr-1" /> : <LockOpen className="w-3.5 h-3.5 text-slate-500 ml-1.5 mr-1" />}
          <input
            type="password"
            value={token}
            onChange={(e) => { setToken(e.target.value); setAuthToken(e.target.value.trim()); }}
            placeholder="API Token"
            autoComplete="off"
            className="bg-transparent text-slate-300 text-xs focus:outline-none w-24 placeholder:text-slate-600"
          />
        </div>
        <button
          onClick={onToggleSound}
          title={soundEnabled ? '关闭音效' : '开启音效'}
          className={`p-2 rounded-lg border transition-all ${
            soundEnabled
              ? 'bg-indigo-950/60 border-indigo-500/40 text-indigo-400 hover:bg-indigo-900/50'
              : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
          }`}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* WebSocket status pill */}
        <div
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border font-mono ${
            wsConnected
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30'
              : 'bg-rose-950/40 text-rose-400 border-rose-500/30'
          }`}
        >
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          <span className="hidden sm:inline">{wsConnected ? t('nav.live') : t('nav.offline')}</span>
        </div>
      </div>
    </header>
  );
};
