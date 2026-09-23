import React, { useEffect, useState } from 'react';
import {
  Webhook,
  Copy,
  Check,
  Trash2,
  Send,
  Radio,
  Search
} from 'lucide-react';
import type { WebhookEvent } from '../types';
import { sound } from '../services/audio';
import { useLang } from '../i18n';
import { api } from '../services/api';

interface WebhooksViewProps {
  webhooks: WebhookEvent[];
  onClearWebhooks: () => void;
  onDeleteWebhook: (id: number) => void;
  onOpenSettings?: () => void;
}

export const WebhooksView: React.FC<WebhooksViewProps> = ({ webhooks, onClearWebhooks, onDeleteWebhook, onOpenSettings }) => {
  const { t } = useLang();
  const [retentionHint, setRetentionHint] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.getMeta()
      .then((m) => {
        if (cancelled || !m) return;
        const hint = t('webhooks.retention_hint')
          .replace('{keep}', String(m.webhookKeep ?? ''))
          .replace('{days}', String(m.webhookTtlDays ?? ''));
        setRetentionHint(hint);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [t]);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [selectedHook, setSelectedHook] = useState<WebhookEvent | null>(null);
  const [search, setSearch] = useState('');
  const [topicFilter, setTopicFilter] = useState<string | null>(null);

  const topics = Array.from(new Set(webhooks.map((h) => h.endpoint))).sort();
  const filtered = webhooks.filter((h) => {
    const q = search.toLowerCase();
    const matchesSearch =
      (h.endpoint || '').toLowerCase().includes(q) ||
      (h.method || '').toLowerCase().includes(q) ||
      (h.payload || '').toLowerCase().includes(q);
    const matchesTopic = !topicFilter || h.endpoint === topicFilter;
    return matchesSearch && matchesTopic;
  });

  const handleDeleteOne = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm(t('common.confirm_delete'))) return;
    if (selectedHook?.id === id) setSelectedHook(null);
    onDeleteWebhook(id);
  };

  const webhookBaseUrl = `${window.location.protocol}//${window.location.hostname}:3001/api/webhooks/catch/alpha`;
  const curlExample = `curl -X POST "${webhookBaseUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{"event": "alert.deploy", "env": "production", "status": "nominal"}'`;

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookBaseUrl);
    sound.playSuccess();
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const copyCurl = () => {
    navigator.clipboard.writeText(curlExample);
    sound.playSuccess();
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  const sendTestWebhook = async () => {
    try {
      sound.playClick();
      await fetch(webhookBaseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'AetherDesk Self-Diagnostic',
          test: true,
          pingTime: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const formatJson = (str: string) => {
    try {
      return JSON.stringify(JSON.parse(str), null, 2);
    } catch (e) {
      return str;
    }
  };

  const getMethodBadge = (m: string) => {
    switch (m.toUpperCase()) {
      case 'POST':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-500/30">POST</span>;
      case 'GET':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-950 text-sky-300 border border-sky-500/30">GET</span>;
      case 'PUT':
      case 'PATCH':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-500/30">{m}</span>;
      case 'DELETE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950 text-rose-300 border border-rose-500/30">DELETE</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">{m}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {retentionHint && (
        <div className="glass-panel px-4 py-2.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-300">
          <span className="font-mono break-all">{(retentionHint || '').slice(0)}</span>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="shrink-0 px-2.5 py-1 rounded-lg border border-slate-700 hover:bg-slate-900/80 text-slate-200 transition-colors"
            >
              {t('webhooks.open_settings')}
            </button>
          )}
        </div>
      )}
      {/* Top Banner: Webhook URL & cURL sample */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-pink-950/60 border border-pink-500/30 text-pink-400">
              <Webhook className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">{t('wh.title')}</h3>
              <p className="text-xs text-slate-400">
                {t('wh.subtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={sendTestWebhook}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-medium transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{t('wh.send_test')}</span>
            </button>
            <button
              onClick={onClearWebhooks}
              className="p-1.5 rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-all cursor-pointer"
              title={t('wh.clear')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* URL & cURL blocks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-2 text-xs">
          <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
            <div className="truncate font-mono text-cyan-300">
              {webhookBaseUrl}
            </div>
            <button
              onClick={copyUrl}
              className="shrink-0 p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="复制 URL"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
            <div className="truncate font-mono text-slate-300">
              cURL: curl -X POST &quot;{webhookBaseUrl}&quot; -d &#39;{`{"ping":1}`}&#39;
            </div>
            <button
              onClick={copyCurl}
              className="shrink-0 p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="复制完整 cURL 命令"
            >
              {copiedCurl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Webhook Stream List & Detail Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Stream List */}
        <div className="lg:col-span-1 glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col h-[560px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs text-slate-400 mb-3">
            <span className="font-semibold text-slate-200">{t('wh.stream')}</span>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
              {filtered.length} / {webhooks.length}
            </span>
          </div>

          {/* Search + topic filter */}
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('wh.search_ph')}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-pink-500"
            />
          </div>
          {topics.length > 0 && (
            <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-1">
              <button
                onClick={() => setTopicFilter(null)}
                className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                  topicFilter === null
                    ? 'bg-pink-600 text-white font-semibold'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {t('snippets.all')}
              </button>
              {topics.map((topic) => (
                <button
                  key={topic}
                  onClick={() => setTopicFilter(topic === topicFilter ? null : topic)}
                  className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                    topicFilter === topic
                      ? 'bg-pink-600 text-white font-semibold'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  /{topic}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {filtered.map((hook) => {
              const isSelected = selectedHook?.id === hook.id;
              return (
                <div
                  key={hook.id}
                  onClick={() => { sound.playClick(); setSelectedHook(hook); }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 ${
                    isSelected
                      ? 'bg-slate-800/80 border-indigo-500 shadow-sm'
                      : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getMethodBadge(hook.method)}
                      <span className="font-mono text-xs text-slate-200 font-semibold">
                        /{hook.endpoint}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-slate-500">
                        {(hook.received_at || '').slice(11, 19) || '--'}
                      </span>
                      <button
                        onClick={(e) => handleDeleteOne(e, hook.id)}
                        className="p-1 rounded text-slate-600 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                        title={t('wh.delete_one')}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="text-[11px] font-mono text-slate-400 truncate">
                    IP: {hook.ip}
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 text-xs space-y-2">
                <Radio className="w-6 h-6 text-slate-600 animate-pulse" />
                <span>{webhooks.length === 0 ? t('wh.waiting') : t('wh.no_match')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Payload & Header Inspector */}
        <div className="lg:col-span-2 glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col h-[560px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs text-slate-400 mb-4">
            <span className="font-semibold text-slate-200">{t('wh.inspector')}</span>
            {selectedHook && (
              <span className="font-mono text-[11px] text-slate-400">
                ID #{selectedHook.id} • {selectedHook.received_at}
              </span>
            )}
          </div>

          {selectedHook ? (
            <div className="flex-1 space-y-4 overflow-y-auto pr-1 text-xs">
              {/* Request Payload */}
              <div>
                <label className="block text-slate-400 font-mono mb-1 text-[11px] uppercase tracking-wider">
                  Body Payload (请求载荷)
                </label>
                <pre className="p-3.5 bg-slate-950 rounded-xl font-mono text-xs text-emerald-300 overflow-x-auto border border-slate-800 max-h-60">
                  {formatJson(selectedHook.payload) || '(空载荷)'}
                </pre>
              </div>

              {/* Headers */}
              <div>
                <label className="block text-slate-400 font-mono mb-1 text-[11px] uppercase tracking-wider">
                  HTTP Headers (请求头)
                </label>
                <pre className="p-3.5 bg-slate-950 rounded-xl font-mono text-xs text-slate-300 overflow-x-auto border border-slate-800 max-h-48">
                  {formatJson(selectedHook.headers)}
                </pre>
              </div>

              {/* Query Params */}
              {selectedHook.query && selectedHook.query !== '{}' && (
                <div>
                  <label className="block text-slate-400 font-mono mb-1 text-[11px] uppercase tracking-wider">
                    Query Parameters (查询参数)
                  </label>
                  <pre className="p-3 bg-slate-950 rounded-xl font-mono text-xs text-amber-300 overflow-x-auto border border-slate-800">
                    {formatJson(selectedHook.query)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-xs italic">
              在左侧列表中点击任意捕获记录以查看详细载荷与标头
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
