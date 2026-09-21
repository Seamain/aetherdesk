import React, { useState } from 'react';
import {
  Webhook,
  Copy,
  Check,
  Trash2,
  Send,
  Radio
} from 'lucide-react';
import type { WebhookEvent } from '../types';
import { sound } from '../services/audio';
import { useLang } from '../i18n';

interface WebhooksViewProps {
  webhooks: WebhookEvent[];
  onClearWebhooks: () => void;
}

export const WebhooksView: React.FC<WebhooksViewProps> = ({ webhooks, onClearWebhooks }) => {
  const { t } = useLang();
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [selectedHook, setSelectedHook] = useState<WebhookEvent | null>(null);

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
      {/* Top Banner: Webhook URL & cURL sample */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-pink-950/60 border border-pink-500/30 text-pink-400">
              <Webhook className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">实时 Webhook 捕获箱 (Live Sink)</h3>
              <p className="text-xs text-slate-400">
                向本端点发送任何 HTTP 请求，仪表盘将通过 WebSocket 毫秒级呈现数据包。
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
            <span className="font-semibold text-slate-200">捕获事件流</span>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
              {webhooks.length} 条
            </span>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {webhooks.map((hook) => {
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
                    <span className="text-[10px] font-mono text-slate-500">
                      {(hook.received_at || '').slice(11, 19) || '--'}
                    </span>
                  </div>

                  <div className="text-[11px] font-mono text-slate-400 truncate">
                    IP: {hook.ip}
                  </div>
                </div>
              );
            })}

            {webhooks.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 text-xs space-y-2">
                <Radio className="w-6 h-6 text-slate-600 animate-pulse" />
                <span>{t('wh.waiting')}</span>
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
