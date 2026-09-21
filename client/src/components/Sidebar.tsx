import React from 'react';
import {
  Activity,
  Kanban,
  Timer,
  Terminal,
  Code2,
  Webhook,
  PlayCircle,
  Globe,
  StickyNote
} from 'lucide-react';
import { useLang } from '../i18n';

export type TabType =
  | 'telemetry'
  | 'kanban'
  | 'focus'
  | 'runner'
  | 'snippets'
  | 'notes'
  | 'webhooks'
  | 'automation'
  | 'api_tester';

interface SidebarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  webhookCount: number;
  taskCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  webhookCount,
  taskCount,
}) => {
  const { t } = useLang();
  const menuItems: Array<{
    id: TabType;
    label: string;
    icon: React.ReactNode;
    badge?: string | number;
    color: string;
  }> = [
    {
      id: 'telemetry',
      label: t('tab.telemetry'),
      icon: <Activity className="w-4 h-4" />,
      color: 'text-cyan-400',
    },
    {
      id: 'kanban',
      label: t('tab.kanban'),
      icon: <Kanban className="w-4 h-4" />,
      badge: taskCount > 0 ? taskCount : undefined,
      color: 'text-indigo-400',
    },
    {
      id: 'focus',
      label: t('tab.focus'),
      icon: <Timer className="w-4 h-4" />,
      color: 'text-rose-400',
    },
    {
      id: 'runner',
      label: t('tab.runner'),
      icon: <Terminal className="w-4 h-4" />,
      color: 'text-emerald-400',
    },
    {
      id: 'snippets',
      label: t('tab.snippets'),
      icon: <Code2 className="w-4 h-4" />,
      color: 'text-amber-400',
    },
    {
      id: 'notes',
      label: t('tab.notes'),
      icon: <StickyNote className="w-4 h-4" />,
      color: 'text-teal-400',
    },
    {
      id: 'webhooks',
      label: t('tab.webhooks'),
      icon: <Webhook className="w-4 h-4" />,
      badge: webhookCount > 0 ? webhookCount : undefined,
      color: 'text-pink-400',
    },
    {
      id: 'automation',
      label: t('tab.automation'),
      icon: <PlayCircle className="w-4 h-4" />,
      color: 'text-blue-400',
    },
    {
      id: 'api_tester',
      label: t('tab.api_tester'),
      icon: <Globe className="w-4 h-4" />,
      color: 'text-violet-400',
    },
  ];

  return (
    <aside className="w-60 shrink-0 border-r border-slate-800/80 bg-slate-950/50 p-3 flex flex-col justify-between hidden md:flex min-h-[calc(100vh-4rem)]">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 font-mono">
          {t('side.title')}
        </div>

        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-950/80 to-purple-950/40 text-white border border-indigo-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={isActive ? item.color : 'text-slate-400'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>

              {item.badge !== undefined && (
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-slate-900/40 border border-slate-800/60 rounded-xl">
        <div className="text-xs text-slate-400 font-medium">{t('side.footer')}</div>
        <div className="text-[11px] text-slate-500 mt-0.5">
          {t('side.sub')}
        </div>
        <div className="mt-2 text-[10px] text-emerald-400 font-mono flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
          {t('side.telemetry_on')}
        </div>
      </div>
    </aside>
  );
};
