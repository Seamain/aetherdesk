import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  Flame,
  Clock,
  Sparkles,
  Coffee,
  Brain
} from 'lucide-react';
import type { PomodoroStats } from '../types';
import { api } from '../services/api';
import { sound } from '../services/audio';
import { useLang } from '../i18n';

type TimerMode = 'work' | 'shortBreak' | 'longBreak';

const MODE_CONFIG: Record<TimerMode, { label: string; duration: number; icon: any; color: string; ringColor: string }> = {
  work: { label: '专注工作 (Focus)', duration: 25 * 60, icon: Brain, color: 'text-indigo-400', ringColor: '#6366f1' },
  shortBreak: { label: '短时小憩 (Break)', duration: 5 * 60, icon: Coffee, color: 'text-emerald-400', ringColor: '#10b981' },
  longBreak: { label: '深度休整 (Rest)', duration: 15 * 60, icon: Sparkles, color: 'text-purple-400', ringColor: '#a855f7' },
};

export const FocusView: React.FC = () => {
  const { t } = useLang();
  const [mode, setMode] = useState<TimerMode>('work');
  const [timeLeft, setTimeLeft] = useState(MODE_CONFIG.work.duration);
  const [isRunning, setIsRunning] = useState(false);
  const [taskNote, setTaskNote] = useState('');
  const [customMinutes, setCustomMinutes] = useState<string>('');
  const [stats, setStats] = useState<PomodoroStats | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Avoid re-creating interval on every keystroke: read latest note via ref
  const taskNoteRef = useRef('');
  useEffect(() => { taskNoteRef.current = taskNote; }, [taskNote]);
  // Track end-time to reduce setInterval drift when tab is throttled
  const endAtRef = useRef<number>(0);

  const effectiveDuration = (() => {
    const custom = parseInt(customMinutes, 10);
    if (customMinutes.trim() !== '' && !isNaN(custom)) {
      return Math.min(Math.max(custom, 1), 180) * 60;
    }
    return MODE_CONFIG[mode].duration;
  })();

  const fetchStats = async () => {
    try {
      const data = await api.getPomodoroStats();
      setStats(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const switchMode = (newMode: TimerMode) => {
    setIsRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setMode(newMode);
    setCustomMinutes('');
    setTimeLeft(MODE_CONFIG[newMode].duration);
    sound.playClick();
  };

  const toggleTimer = () => {
    sound.playClick();
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    sound.playClick();
    setIsRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(effectiveDuration);
  };

  useEffect(() => {
    if (isRunning) {
      endAtRef.current = Date.now() + timeLeft * 1000;
      timerRef.current = setInterval(() => {
        const remain = Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000));
        setTimeLeft(remain);
        if (remain <= 0) {
          clearInterval(timerRef.current!);
          setIsRunning(false);
          sound.playTimerComplete();
          document.title = '✅ 专注完成！— AetherDesk';

          // Log session (use ref so typing doesn't restart timer)
          api.logPomodoroSession(mode, effectiveDuration, taskNoteRef.current || '未指定专注任务')
            .then(() => fetchStats())
            .catch(console.error);
        }
      }, 500);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, mode]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const totalDuration = effectiveDuration || 1;
  const progressPercent = ((totalDuration - timeLeft) / totalDuration) * 100;

  // SVG Circular Gauge
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-indigo-950/60 border border-indigo-500/30 text-indigo-400">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">{t('focus.today_count')}</div>
            <div className="text-2xl font-bold font-mono text-white">
              {stats?.today.count || 0} <span className="text-xs text-slate-400 font-normal">{t('focus.times')}</span>
            </div>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-purple-950/60 border border-purple-500/30 text-purple-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">{t('focus.today_minutes')}</div>
            <div className="text-2xl font-bold font-mono text-white">
              {stats?.today.totalMinutes || 0} <span className="text-xs text-slate-400 font-normal">{t('focus.minutes')}</span>
            </div>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">{t('focus.mode')}</div>
            <div className="text-lg font-bold text-slate-200">
              {MODE_CONFIG[mode].label.split(' ')[0]}
            </div>
          </div>
        </div>
      </div>

      {/* Main Focus Clock & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-panel p-8 rounded-2xl border border-slate-800 flex flex-col items-center justify-center">
          {/* Mode Switcher */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl mb-8 text-xs font-medium">
            {(Object.keys(MODE_CONFIG) as TimerMode[]).map((m) => {
              const cfg = MODE_CONFIG[m];
              const Icon = cfg.icon;
              const isActive = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                    isActive
                      ? 'bg-slate-800 text-white shadow-md border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? cfg.color : ''}`} />
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>

          {/* Circular SVG Timer */}
          <div className="relative flex items-center justify-center">
            <svg width="280" height="280" className="transform -rotate-90">
              {/* Background Track */}
              <circle
                cx="140"
                cy="140"
                r={radius}
                stroke="#1e293b"
                strokeWidth="12"
                fill="transparent"
              />
              {/* Animated Progress */}
              <circle
                cx="140"
                cy="140"
                r={radius}
                stroke={MODE_CONFIG[mode].ringColor}
                strokeWidth="12"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
              />
            </svg>

            {/* Inner Display */}
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-5xl font-extrabold font-mono tracking-tight text-white">
                {timeFormatted}
              </span>
              <span className="text-xs text-slate-400 font-mono mt-2 uppercase tracking-wider">
                {isRunning ? '专注进行中 • FLOW' : '准备就绪'}
              </span>
            </div>
          </div>

          {/* Current Task Input */}
          <div className="w-full max-w-sm mt-8 space-y-2">
            <input
              type="text"
              value={taskNote}
              onChange={(e) => setTaskNote(e.target.value)}
              placeholder={t('focus.task_ph')}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 text-center focus:outline-none focus:border-indigo-500"
            />
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <span className="font-mono">{t('focus.custom')}</span>
              <input type="number" min={1} max={180} value={customMinutes}
                onChange={(e) => { setCustomMinutes(e.target.value); setIsRunning(false); if (timerRef.current) clearInterval(timerRef.current);
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v)) setTimeLeft(Math.min(Math.max(v, 1), 180) * 60); }}
                placeholder="25"
                className="w-16 px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-center font-mono text-slate-200 focus:outline-none focus:border-indigo-500" />
              <span className="font-mono">{t('focus.custom_suffix')}</span>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center gap-4 mt-6">
            <button
              onClick={toggleTimer}
              className={`flex items-center gap-2 px-8 py-3 rounded-2xl text-sm font-bold transition-all shadow-lg cursor-pointer ${
                isRunning
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
              }`}
            >
              {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
              <span>{isRunning ? t('focus.pause') : t('focus.start')}</span>
            </button>

            <button
              onClick={resetTimer}
              className="p-3 rounded-2xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all cursor-pointer"
              title="重置计时"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* History of Completed Sessions */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-sm text-slate-200 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" />
              {t('focus.history')}
            </h3>

            <div className="space-y-2.5 overflow-y-auto max-h-[380px] pr-1">
              {stats?.logs && stats.logs.length > 0 ? (
                stats.logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-medium text-slate-200">
                        {log.task_title || '专注心流时段'}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {(log.completed_at || '').slice(5, 16) || '--'}
                      </div>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-500/30">
                      {Math.round(log.duration_seconds / 60)} {t('focus.minutes')}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-slate-500 text-xs">
                  {t('focus.empty_log')}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span>科学间歇原则</span>
            <span className="text-indigo-400 font-mono">25m 专注 + 5m 休息</span>
          </div>
        </div>
      </div>
    </div>
  );
};
