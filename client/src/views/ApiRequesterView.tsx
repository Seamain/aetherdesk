import React, { useState, useEffect } from 'react';
import {
  Send,
  Clock,
  AlertTriangle,
  Copy,
  Check,
  Globe,
  History,
  Trash2
} from 'lucide-react';
import { api } from '../services/api';
import { sound } from '../services/audio';
import { useLang } from '../i18n';

interface HistoryEntry {
  id: number;
  method: string;
  url: string;
  headersText: string;
  bodyText: string;
  status: number | null;
  durationMs: number | null;
  at: string;
}

const HISTORY_KEY = 'aether-api-history';
const HISTORY_MAX = 20;

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export const ApiRequesterView: React.FC = () => {
  const { t } = useLang();
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'>('GET');
  const [url, setUrl] = useState('http://localhost:3001/api/system/status');
  const [headersText, setHeadersText] = useState('{\n  "Accept": "application/json"\n}');
  const [bodyText, setBodyText] = useState('{\n  "test": true\n}');
  const [activeTab, setActiveTab] = useState<'body' | 'headers'>('body');

  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{
    status: number;
    statusText: string;
    durationMs: number;
    headers: Record<string, string>;
    data: any;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());

  useEffect(() => {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {}
  }, [history]);

  const pushHistory = (status: number | null, durationMs: number | null) => {
    const entry: HistoryEntry = {
      id: Date.now(),
      method,
      url: url.trim(),
      headersText,
      bodyText,
      status,
      durationMs,
      at: new Date().toLocaleString(),
    };
    setHistory((prev) => [entry, ...prev].slice(0, HISTORY_MAX));
  };

  const refillFromHistory = (h: HistoryEntry) => {
    sound.playClick();
    setMethod(h.method as any);
    setUrl(h.url);
    setHeadersText(h.headersText);
    setBodyText(h.bodyText);
    setResponse(null);
    setError(null);
  };

  const handleSend = async () => {
    if (!url.trim()) return;
    try {
      setLoading(true);
      setError(null);
      sound.playClick();

      let parsedHeaders = {};
      try {
        if (headersText.trim()) parsedHeaders = JSON.parse(headersText);
      } catch (e) {
        throw new Error('Headers 不是合法的 JSON 格式');
      }

      let parsedBody = undefined;
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        try {
          if (bodyText.trim()) parsedBody = JSON.parse(bodyText);
        } catch (e) {
          throw new Error('Body 载荷不是合法的 JSON 格式');
        }
      }

      const res = await api.sendHttpRequest({
        url: url.trim(),
        method,
        headers: parsedHeaders,
        body: parsedBody,
      });

      setResponse(res);
      pushHistory(res.status ?? null, res.durationMs ?? null);
      sound.playSuccess();
    } catch (err: any) {
      setError(err.message);
      setResponse(null);
      pushHistory(null, null);
    } finally {
      setLoading(false);
    }
  };

  const copyResponse = () => {
    if (!response) return;
    const text = typeof response.data === 'object' ? JSON.stringify(response.data, null, 2) : String(response.data);
    navigator.clipboard.writeText(text);
    sound.playClick();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Request Form */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Method Selector */}
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as any)}
            className="px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="GET" className="text-sky-400">GET</option>
            <option value="POST" className="text-emerald-400">POST</option>
            <option value="PUT" className="text-amber-400">PUT</option>
            <option value="PATCH" className="text-purple-400">PATCH</option>
            <option value="DELETE" className="text-rose-400">DELETE</option>
          </select>

          {/* URL Input */}
          <div className="relative flex-1">
            <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.example.com/v1/resource..."
              className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs shadow-lg shadow-violet-600/30 transition-all cursor-pointer disabled:opacity-50"
          >
            <Send className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Loading...' : `${t('api.send')} (Send)`}</span>
          </button>
        </div>

        {/* Request Sub-tabs (Body / Headers) */}
        <div className="pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setActiveTab('body')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'body'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              JSON Body
            </button>
            <button
              onClick={() => setActiveTab('headers')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'headers'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Request Headers
            </button>
          </div>

          {activeTab === 'body' ? (
            <textarea
              rows={4}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder='{\n  "key": "value"\n}'
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
            />
          ) : (
            <textarea
              rows={4}
              value={headersText}
              onChange={(e) => setHeadersText(e.target.value)}
              placeholder='{\n  "Authorization": "Bearer token"\n}'
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
            />
          )}
        </div>
      </div>

      {/* History Strip */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <History className="w-3.5 h-3.5 text-violet-400" />
            {t('api.history')}
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400">{history.length}</span>
          </span>
          {history.length > 0 && (
            <button
              onClick={() => { sound.playClick(); setHistory([]); }}
              className="text-[11px] text-slate-500 hover:text-rose-400 transition-colors"
            >
              {t('api.clear')}
            </button>
          )}
        </div>
        {history.length > 0 ? (
          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            {history.map((h) => (
              <div
                key={h.id}
                onClick={() => refillFromHistory(h)}
                className="flex items-center gap-2 p-2 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-violet-500/50 cursor-pointer transition-all text-xs"
              >
                <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 shrink-0">{h.method}</span>
                <span className="font-mono text-slate-300 truncate flex-1">{h.url}</span>
                {h.status !== null && (
                  <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded shrink-0 ${h.status >= 200 && h.status < 300 ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'}`}>
                    {h.status}
                  </span>
                )}
                <span className="font-mono text-[10px] text-slate-500 shrink-0 hidden sm:inline">{h.at}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setHistory((prev) => prev.filter((x) => x.id !== h.id)); }}
                  className="p-1 rounded text-slate-600 hover:text-rose-400 shrink-0"
                  title={t('common.delete')}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-slate-600 italic">{t('api.empty')}</div>
        )}
      </div>

      {/* Response Panel */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col min-h-[380px]">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs text-slate-400 mb-3">
          <span className="font-semibold text-slate-200">响应结果 (Response Viewer)</span>

          {response && (
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span className="flex items-center gap-1 text-slate-400">
                <Clock className="w-3 h-3" />
                {response.durationMs} ms
              </span>
              <span
                className={`px-2 py-0.5 rounded font-bold ${
                  response.status >= 200 && response.status < 300
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-950 text-rose-300 border border-rose-500/30'
                }`}
              >
                {response.status} {response.statusText}
              </span>
              <button
                onClick={copyResponse}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                title="复制响应内容"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4" />
            <span>请求发生异常: {error}</span>
          </div>
        )}

        <div className="flex-1 bg-black/90 p-4 rounded-xl font-mono text-xs overflow-y-auto border border-slate-800/80">
          {response ? (
            <pre className="text-cyan-300 whitespace-pre-wrap leading-relaxed">
              {typeof response.data === 'object' ? JSON.stringify(response.data, null, 2) : String(response.data)}
            </pre>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-600 italic">
              在上方配置 URL 并点击「发送请求」查看接口响应
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
