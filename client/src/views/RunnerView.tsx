import React, { useState } from 'react';
import {
  Play,
  Copy,
  Check,
  Clock,
  Terminal as TerminalIcon,
  Code2,
  FileCode2
} from 'lucide-react';
import { api } from '../services/api';
import { sound } from '../services/audio';
import { useLang } from '../i18n';

const TEMPLATES: Record<string, { label: string; lang: string; code: string }> = {
  linux_audit: {
    label: 'Linux 内核与系统体检',
    lang: 'bash',
    code: `echo "=== 操作系统与内核版本 ==="
uname -a
echo ""
echo "=== 当前登录用户与会话 ==="
who
echo ""
echo "=== 系统启动时间与负载 ==="
uptime
echo ""
echo "=== 内存简况 ==="
free -h`,
  },
  py_sysinfo: {
    label: 'Python 系统环境探测',
    lang: 'python',
    code: `import sys
import platform
import os

print(f"Python 解释器版本: {sys.version.split()[0]}")
print(f"平台体系: {platform.platform()}")
print(f"处理器架构: {platform.machine()}")
print(f"CPU 逻辑核心数: {os.cpu_count()}")
print(f"当前工作目录: {os.getcwd()}")
`,
  },
  node_bench: {
    label: 'Node.js 算力基准测试',
    lang: 'javascript',
    code: `const start = performance.now();
let count = 0;
for (let i = 0; i < 5_000_000; i++) {
  count += Math.sqrt(i);
}
const duration = (performance.now() - start).toFixed(2);
console.log(\`计算 5,000,000 次开方运算完成！\`);
console.log(\`累计数值: \${Math.round(count)}\`);
console.log(\`V8 引擎总耗时: \${duration} ms\`);
`,
  },
  net_scan: {
    label: 'Bash 快速网络探测',
    lang: 'bash',
    code: `echo "=== 默认网关与路由 ==="
ip route show default 2>/dev/null || route -n
echo ""
echo "=== 网络接口 IP 分配 ==="
ip -br addr 2>/dev/null || ifconfig -s`,
  },
};

export const RunnerView: React.FC = () => {
  const { t } = useLang();
  const [language, setLanguage] = useState<'bash' | 'python' | 'javascript'>('bash');
  const [code, setCode] = useState(TEMPLATES.linux_audit.code);
  const [output, setOutput] = useState<{
    stdout: string;
    stderr: string;
    exitCode: number;
    executionTimeMs: number;
  } | null>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRun = async () => {
    if (!code.trim()) return;
    try {
      setRunning(true);
      sound.playClick();
      const res = await api.runSnippetCode(language, code);
      setOutput(res);
      if (res.success) {
        sound.playSuccess();
      }
    } catch (err: any) {
      setOutput({
        stdout: '',
        stderr: err.message,
        exitCode: -1,
        executionTimeMs: 0,
      });
    } finally {
      setRunning(false);
    }
  };

  const loadTemplate = (key: string) => {
    const tmpl = TEMPLATES[key];
    if (tmpl) {
      setLanguage(tmpl.lang as any);
      setCode(tmpl.code);
      sound.playClick();
    }
  };

  const copyOutput = () => {
    if (!output) return;
    const text = output.stdout || output.stderr;
    navigator.clipboard.writeText(text);
    setCopied(true);
    sound.playClick();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Language selector */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs">
            <Code2 className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            <button
              onClick={() => { setLanguage('bash'); sound.playClick(); }}
              className={`px-3 py-1.5 rounded-lg font-mono transition-all ${
                language === 'bash'
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Bash (Shell)
            </button>
            <button
              onClick={() => { setLanguage('python'); sound.playClick(); }}
              className={`px-3 py-1.5 rounded-lg font-mono transition-all ${
                language === 'python'
                  ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Python 3
            </button>
            <button
              onClick={() => { setLanguage('javascript'); sound.playClick(); }}
              className={`px-3 py-1.5 rounded-lg font-mono transition-all ${
                language === 'javascript'
                  ? 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Node.js
            </button>
          </div>

          {/* Quick Preset Buttons */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 text-[11px] ml-2">预设示例:</span>
            {Object.entries(TEMPLATES).map(([key, t]) => (
              <button
                key={key}
                onClick={() => loadTemplate(key)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-colors text-[11px]"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Run button */}
        <button
          onClick={handleRun}
          disabled={running}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
        >
          <Play className={`w-3.5 h-3.5 ${running ? 'animate-spin' : 'fill-white'}`} />
          <span>{running ? 'Running...' : `${t('runner.run')} (Run)`}</span>
        </button>
      </div>

      {/* Editor & Output Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Code Input */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col h-[520px]">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-emerald-400" />
              <span className="font-mono font-medium text-slate-200">输入代码脚本</span>
            </div>
            <span className="font-mono text-[11px] text-slate-500">
              超时安全门限: 15s
            </span>
          </div>

          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="在此输入或粘贴代码..."
            spellCheck={false}
            className="flex-1 w-full bg-slate-950 p-3.5 rounded-xl font-mono text-xs text-slate-200 border border-slate-800/80 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
          />
        </div>

        {/* Output Console */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col h-[520px]">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <TerminalIcon className="w-4 h-4 text-cyan-400" />
              <span className="font-mono font-medium text-slate-200">{t('runner.output')}</span>
            </div>

            {output && (
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="flex items-center gap-1 text-slate-400">
                  <Clock className="w-3 h-3" />
                  {output.executionTimeMs}ms
                </span>
                <span
                  className={`px-2 py-0.5 rounded ${
                    output.exitCode === 0
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-950 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  Exit: {output.exitCode}
                </span>
                <button
                  onClick={copyOutput}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                  title="复制终端输出"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 bg-black/90 p-3.5 rounded-xl font-mono text-xs overflow-y-auto border border-slate-800/80 space-y-2">
            {output ? (
              <>
                {output.stdout && (
                  <pre className="text-emerald-400 whitespace-pre-wrap leading-relaxed font-mono">
                    {output.stdout}
                  </pre>
                )}
                {output.stderr && (
                  <pre className="text-rose-400 whitespace-pre-wrap leading-relaxed font-mono">
                    {output.stderr}
                  </pre>
                )}
                {!output.stdout && !output.stderr && (
                  <span className="text-slate-500 italic">进程执行结束，无标准输出。</span>
                )}
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600 italic">
                点击上方「即时运行」按钮以启动沙盒执行
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
