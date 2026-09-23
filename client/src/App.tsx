import React, { useState, useEffect, useRef } from 'react';
import type { SystemTelemetry, Task, WebhookEvent } from './types';
import { api } from './services/api';
import { sound } from './services/audio';
import { useLang } from './i18n';

import { Navbar } from './components/Navbar';
import { Sidebar, type TabType } from './components/Sidebar';
import { ErrorBoundary } from './components/ErrorBoundary';

import { TelemetryView } from './views/TelemetryView';
import { KanbanView } from './views/KanbanView';
import { FocusView } from './views/FocusView';
import { RunnerView } from './views/RunnerView';
import { SnippetsView } from './views/SnippetsView';
import { NotesView } from './views/NotesView';
import { WebhooksView } from './views/WebhooksView';
import { AutomationView } from './views/AutomationView';
import { ApiRequesterView } from './views/ApiRequesterView';
import { SettingsView } from './views/SettingsView';

export const App: React.FC = () => {
  const { t } = useLang();
  const [activeTab, setActiveTab] = useState<TabType>('telemetry');
  const [telemetry, setTelemetry] = useState<SystemTelemetry | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [ambientType, setAmbientType] = useState<'off' | 'white' | 'pink' | 'rain'>('off');

  // Counts for sidebar badges
  const [tasks, setTasks] = useState<Task[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookEvent[]>([]);
  const [showAuthBanner, setShowAuthBanner] = useState(false);

  // Telemetry rolling history for sparklines
  const [history, setHistory] = useState<{
    cpu: number[];
    memory: number[];
    networkRx: number[];
    networkTx: number[];
  }>({
    cpu: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    memory: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    networkRx: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    networkTx: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  });

  const wsRef = useRef<WebSocket | null>(null);

  // Initial data loading + 401 listener (server token mode)
  useEffect(() => {
    api.getTasks().then(setTasks).catch(console.error);
    api.getWebhooks().then(setWebhooks).catch(console.error);
    const onAuth = () => setShowAuthBanner(true);
    window.addEventListener('aether:unauthorized', onAuth);
    return () => window.removeEventListener('aether:unauthorized', onAuth);
  }, []);

  // WebSocket Connection
  useEffect(() => {
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.hostname}:3001/ws`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'telemetry') {
            const data: SystemTelemetry = msg.data;
            setTelemetry(data);

            setHistory((prev) => ({
              cpu: [...prev.cpu.slice(-24), data.cpu.usagePercent],
              memory: [...prev.memory.slice(-24), data.memory.percent],
              networkRx: [...prev.networkRx.slice(-24), data.network.rxRateKBs],
              networkTx: [...prev.networkTx.slice(-24), data.network.txRateKBs],
            }));
          } else if (msg.type === 'webhook_received') {
            setWebhooks((prev) => [msg.data, ...prev]);
            sound.playAlert();
          } else if (msg.type === 'task_created') {
            setTasks((prev) => [msg.data, ...prev]);
          } else if (msg.type === 'task_updated') {
            setTasks((prev) => prev.map((t) => (t.id === msg.data.id ? msg.data : t)));
          } else if (msg.type === 'task_deleted') {
            setTasks((prev) => prev.filter((t) => t.id !== msg.data.id));
          }
        } catch (e) {
          console.error('WS parse error:', e);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        reconnectTimeout = setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWebSocket();

    return () => {
      clearTimeout(reconnectTimeout);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sound.enabled = next;
  };

  const handleChangeAmbient = (type: 'off' | 'white' | 'pink' | 'rain') => {
    setAmbientType(type);
    sound.setAmbient(type, 0.04);
  };

  const handleClearWebhooks = async () => {
    if (!confirm('确定清空所有已捕获的 Webhook 记录吗？')) return;
    try {
      await api.clearWebhooks();
      setWebhooks([]);
      sound.playClick();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteWebhook = async (id: number) => {
    try {
      await api.deleteWebhook(id);
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      sound.playClick();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Bar */}
      <Navbar
        telemetry={telemetry}
        wsConnected={wsConnected}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        ambientType={ambientType}
        onChangeAmbient={handleChangeAmbient}
      />

      {/* Main Container */}
      <div className="flex-1 flex max-w-[1920px] w-full mx-auto">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            sound.playClick();
            setActiveTab(tab);
          }}
          webhookCount={webhooks.length}
          taskCount={tasks.filter((t) => t.status !== 'done').length}
        />

        {/* Dynamic Content View Area */}
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
          {showAuthBanner && (
            <div className="mb-4 p-3 rounded-2xl border border-amber-500/40 bg-amber-950/40 text-xs text-amber-200 flex items-center justify-between gap-3">
              <span>🔒 {t('auth.required')}</span>
              <button
                onClick={() => setShowAuthBanner(false)}
                className="shrink-0 px-2.5 py-1 rounded-lg border border-amber-500/40 hover:bg-amber-900/50 transition-colors"
              >
                {t('auth.dismiss')}
              </button>
            </div>
          )}
          <ErrorBoundary key={activeTab} title={t('err.title')} body={t('err.body')} retry={t('err.retry')}>
          {activeTab === 'telemetry' && (
            <TelemetryView telemetry={telemetry} history={history} />
          )}

          {activeTab === 'kanban' && <KanbanView />}

          {activeTab === 'focus' && <FocusView />}

          {activeTab === 'runner' && <RunnerView />}

          {activeTab === 'snippets' && <SnippetsView />}

          {activeTab === 'notes' && <NotesView />}

          {activeTab === 'webhooks' && (
            <WebhooksView webhooks={webhooks} onClearWebhooks={handleClearWebhooks} onDeleteWebhook={handleDeleteWebhook} onOpenSettings={() => setActiveTab('settings')} />
          )}

          {activeTab === 'automation' && <AutomationView />}

          {activeTab === 'api_tester' && <ApiRequesterView />}

          {activeTab === 'settings' && <SettingsView />}
          </ErrorBoundary>
        </main>
      </div>

      {/* Mobile bottom nav (md:hidden) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-2 py-2 flex items-center justify-between overflow-x-auto">
        {([
          ['telemetry', t('tab.telemetry')],
          ['kanban', t('tab.kanban')],
          ['focus', t('tab.focus')],
          ['runner', t('tab.runner')],
          ['snippets', t('tab.snippets')],
          ['notes', t('tab.notes')],
          ['webhooks', t('tab.webhooks')],
          ['automation', t('tab.automation')],
          ['api_tester', t('tab.api_tester')],
          ['settings', t('tab.settings')],
        ] as Array<[TabType, string]>).map(([id, label]) => (
          <button key={id} onClick={() => { sound.playClick(); setActiveTab(id); window.scrollTo({ top: 0 }); }}
            className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium min-w-[52px] ${activeTab === id ? 'bg-indigo-950/80 text-white border border-indigo-500/40' : 'text-slate-400'}`}>
            <span>{label}</span>
            {id === 'webhooks' && webhooks.length > 0 && <span className="text-[9px] font-mono px-1 rounded-full bg-pink-600 text-white">{webhooks.length}</span>}
            {id === 'kanban' && tasks.filter((t) => t.status !== 'done').length > 0 && <span className="text-[9px] font-mono px-1 rounded-full bg-indigo-600 text-white">{tasks.filter((t) => t.status !== 'done').length}</span>}
          </button>
        ))}
      </nav>
      {/* spacer so content isn't hidden behind mobile nav */}
      <div className="md:hidden h-16" />
    </div>
  );
};

export default App;
