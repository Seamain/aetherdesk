import React, { useState } from 'react';
import {
  Send,
  Clock,
  AlertTriangle,
  Copy,
  Check,
  Globe
} from 'lucide-react';
import { api } from '../services/api';
import { sound } from '../services/audio';
import { useLang } from '../i18n';

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
      sound.playSuccess();
    } catch (err: any) {
      setError(err.message);
      setResponse(null);
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
