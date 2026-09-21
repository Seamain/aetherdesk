import React, { useState, useEffect } from 'react';
import {
  Cpu,
  HardDrive,
  Network,
  Disc,
  Clock,
  Shield,
  RefreshCw,
  Trash2,
  Search,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import type { SystemTelemetry, TopProcess } from '../types';
import { api } from '../services/api';
import { sound } from '../services/audio';
import { useLang } from '../i18n';

interface TelemetryViewProps {
  telemetry: SystemTelemetry | null;
  history: {
    cpu: number[];
    memory: number[];
    networkRx: number[];
    networkTx: number[];
  };
}

export const TelemetryView: React.FC<TelemetryViewProps> = ({ telemetry, history }) => {
  const { lang } = useLang();
  const [processes, setProcesses] = useState<TopProcess[]>([]);
  const [loadingProcs, setLoadingProcs] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchProcesses = async () => {
    try {
      setLoadingProcs(true);
      const procs = await api.getProcesses(15);
      setProcesses(procs);
    } catch (err: any) {
      console.error('Failed to fetch processes:', err);
    } finally {
      setLoadingProcs(false);
    }
  };

  useEffect(() => {
    fetchProcesses();
    const interval = setInterval(fetchProcesses, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleKillProcess = async (pid: string, name: string) => {
    const confirmText =
      lang === 'en' ? `Kill process ${name} (PID: ${pid})?`
      : lang === 'hant' ? `確定要終止行程 ${name} (PID: ${pid}) 嗎？`
      : lang === 'yue' ? `真係要殺咗 ${name} (PID: ${pid})？`
      : `确定要终止进程 ${name} (PID: ${pid}) 吗？`;
    if (!confirm(confirmText)) return;
    try {
      await api.killProcess(pid);
      sound.playSuccess();
      const okText =
        lang === 'en' ? `Killed PID ${pid}`
        : lang === 'hant' ? `已成功終止行程 PID ${pid}`
        : lang === 'yue' ? `殺咗 PID ${pid} 啦`
        : `已成功终止进程 PID ${pid}`;
      setMessage({ type: 'success', text: okText });
      fetchProcesses();
      setTimeout(() => setMessage(null), 3500);
    } catch (err: any) {
      const failText =
        lang === 'en' ? `Kill failed: ${err.message}`
        : lang === 'hant' ? `終止行程失敗: ${err.message}`
        : lang === 'yue' ? `殺唔到: ${err.message}`
        : `终止进程失败: ${err.message}`;
      setMessage({ type: 'error', text: failText });
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const filteredProcesses = processes.filter(
    (p) =>
      p.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      p.pid.includes(filterQuery) ||
      p.user.toLowerCase().includes(filterQuery.toLowerCase())
  );

  // SVG Sparkline Helper
  const renderSparkline = (data: number[], maxVal = 100, strokeColor = '#38bdf8', fillColor = 'rgba(56, 189, 248, 0.15)') => {
    if (!data || data.length < 2) return null;
    const width = 160;
    const height = 40;
    const points = data
      .map((val, idx) => {
        const x = (idx / (data.length - 1)) * width;
        const normalized = Math.min(maxVal, Math.max(0, val));
        const y = height - (normalized / maxVal) * (height - 4) - 2;
        return `${x},${y}`;
      })
      .join(' ');

    const areaPoints = `0,${height} ${points} ${width},${height}`;

    return (
      <svg width={width} height={height} className="overflow-visible">
        <polygon points={areaPoints} fill={fillColor} />
        <polyline fill="none" stroke={strokeColor} strokeWidth="2" points={points} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      {/* Banner / Message Alert */}
      {message && (
        <div
          className={`flex items-center gap-2 p-3 rounded-xl border text-sm transition-all ${
            message.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Top 4 Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU Usage Card */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-cyan-400">
              <Cpu className="w-5 h-5" />
              <span className="font-semibold text-sm text-slate-200">CPU 总负载</span>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {telemetry?.static.cpuCount || 0} Cores
            </span>
          </div>

          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-3xl font-extrabold font-mono tracking-tight text-white">
              {telemetry ? telemetry.cpu.usagePercent : 0}
              <span className="text-lg text-slate-400 font-normal">%</span>
            </div>
            {renderSparkline(history.cpu, 100, '#38bdf8', 'rgba(56, 189, 248, 0.12)')}
          </div>

          <div className="mt-3 w-full bg-slate-800/80 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                (telemetry?.cpu.usagePercent || 0) > 80
                  ? 'bg-rose-500'
                  : (telemetry?.cpu.usagePercent || 0) > 50
                  ? 'bg-amber-500'
                  : 'bg-cyan-500'
              }`}
              style={{ width: `${telemetry?.cpu.usagePercent || 0}%` }}
            ></div>
          </div>
        </div>

        {/* Memory Card */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-purple-400">
              <HardDrive className="w-5 h-5" />
              <span className="font-semibold text-sm text-slate-200">物理内存占用</span>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {telemetry ? `${telemetry.memory.usedMB} / ${telemetry.memory.totalMB} MB` : ''}
            </span>
          </div>

          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-3xl font-extrabold font-mono tracking-tight text-white">
              {telemetry ? telemetry.memory.percent : 0}
              <span className="text-lg text-slate-400 font-normal">%</span>
            </div>
            {renderSparkline(history.memory, 100, '#c084fc', 'rgba(192, 132, 252, 0.12)')}
          </div>

          <div className="mt-3 w-full bg-slate-800/80 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                (telemetry?.memory.percent || 0) > 85 ? 'bg-rose-500' : 'bg-purple-500'
              }`}
              style={{ width: `${telemetry?.memory.percent || 0}%` }}
            ></div>
          </div>
        </div>

        {/* Network Traffic Card */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400">
              <Network className="w-5 h-5" />
              <span className="font-semibold text-sm text-slate-200">网络瞬时吞吐</span>
            </div>
            <span className="text-xs font-mono text-slate-400">实时 I/O</span>
          </div>

          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <div className="text-xs text-slate-400 font-mono">
                ↓ {telemetry?.network.rxRateKBs || 0} KB/s
              </div>
              <div className="text-lg font-bold font-mono text-emerald-400">
                ↑ {telemetry?.network.txRateKBs || 0} <span className="text-xs font-normal text-slate-400">KB/s</span>
              </div>
            </div>
            {renderSparkline(history.networkRx, 1000, '#34d399', 'rgba(52, 211, 153, 0.12)')}
          </div>

          <div className="mt-3 flex justify-between text-[11px] font-mono text-slate-400">
            <span>总下行: {telemetry?.network.totalRxMB || 0} MB</span>
            <span>总上行: {telemetry?.network.totalTxMB || 0} MB</span>
          </div>
        </div>

        {/* Disk Storage Card */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400">
              <Disc className="w-5 h-5" />
              <span className="font-semibold text-sm text-slate-200">主磁盘存储 (/)</span>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {telemetry?.disk.used} / {telemetry?.disk.total}
            </span>
          </div>

          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-3xl font-extrabold font-mono tracking-tight text-white">
              {telemetry?.disk.percent || 0}
              <span className="text-lg text-slate-400 font-normal">%</span>
            </div>
            <span className="text-xs font-mono px-2 py-1 rounded bg-slate-800/80 text-slate-300">
              剩余 {telemetry?.disk.available}
            </span>
          </div>

          <div className="mt-3 w-full bg-slate-800/80 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                (telemetry?.disk.percent || 0) > 90 ? 'bg-rose-500' : 'bg-amber-500'
              }`}
              style={{ width: `${telemetry?.disk.percent || 0}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Middle Section: CPU Multi-Core Breakdown & System Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Core-by-core CPU heatmap */}
        <div className="lg:col-span-2 glass-panel p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <h3 className="font-semibold text-sm text-slate-200">多核处理器负载矩阵 (Per-Core Breakdown)</h3>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {telemetry?.static.cpuModel}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {telemetry?.cpu.cores && telemetry.cpu.cores.length > 0 ? (
              telemetry.cpu.cores.map((core) => {
                const isHigh = core.usage > 75;
                const isMed = core.usage > 40;
                return (
                  <div
                    key={core.core}
                    className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-mono text-slate-400 uppercase">{core.core}</span>
                      <span
                        className={`font-mono font-bold ${
                          isHigh ? 'text-rose-400' : isMed ? 'text-amber-400' : 'text-cyan-400'
                        }`}
                      >
                        {core.usage}%
                      </span>
                    </div>

                    <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isHigh ? 'bg-rose-500' : isMed ? 'bg-amber-500' : 'bg-cyan-500'
                        }`}
                        style={{ width: `${Math.min(100, core.usage)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-4 text-center py-6 text-slate-500 text-xs">
                正在计算多核周期统计...
              </div>
            )}
          </div>
        </div>

        {/* System Specs Snapshot */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-indigo-400" />
              <h3 className="font-semibold text-sm text-slate-200">系统内核与运行环境</h3>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">操作系统</span>
                <span className="font-mono text-cyan-300">{telemetry?.static.osName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Linux 内核</span>
                <span className="font-mono text-slate-300 truncate max-w-[170px]" title={telemetry?.static.kernel}>
                  {telemetry?.static.kernel}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">体系架构</span>
                <span className="font-mono text-slate-300">{telemetry?.static.arch}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Node.js 运行时</span>
                <span className="font-mono text-emerald-400">{telemetry?.static.nodeVersion}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">负载平衡 (1/5/15m)</span>
                <span className="font-mono text-amber-300">
                  {telemetry?.loadavg['1m']} / {telemetry?.loadavg['5m']} / {telemetry?.loadavg['15m']}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>SQLite 数据库引擎</span>
            <span className="text-emerald-400 font-mono">WAL 并发模式</span>
          </div>
        </div>
      </div>

      {/* Bottom Section: Top Running Processes */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-sm text-slate-200">高资源占用进程监控 (Top Processes)</h3>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="搜索进程名或 PID..."
                className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 w-48"
              />
            </div>

            <button
              onClick={fetchProcesses}
              disabled={loadingProcs}
              className="p-1.5 rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all cursor-pointer"
              title="刷新进程列表"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingProcs ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono">
                <th className="pb-2.5 font-medium">PID</th>
                <th className="pb-2.5 font-medium">用户</th>
                <th className="pb-2.5 font-medium">CPU %</th>
                <th className="pb-2.5 font-medium">MEM %</th>
                <th className="pb-2.5 font-medium">CPU 时间</th>
                <th className="pb-2.5 font-medium">进程命令</th>
                <th className="pb-2.5 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredProcesses.map((proc) => (
                <tr key={proc.pid} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 text-indigo-400 font-semibold">{proc.pid}</td>
                  <td className="py-2.5 text-slate-300">{proc.user}</td>
                  <td className="py-2.5">
                    <span
                      className={`px-1.5 py-0.5 rounded ${
                        proc.cpu > 20
                          ? 'bg-rose-950/80 text-rose-300 font-bold'
                          : proc.cpu > 5
                          ? 'bg-amber-950/60 text-amber-300'
                          : 'text-slate-300'
                      }`}
                    >
                      {proc.cpu.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2.5 text-purple-300">{proc.mem.toFixed(1)}%</td>
                  <td className="py-2.5 text-slate-400">{proc.time}</td>
                  <td className="py-2.5 text-slate-200 max-w-xs truncate" title={proc.name}>
                    {proc.name}
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => handleKillProcess(proc.pid, proc.name)}
                      className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 transition-colors cursor-pointer"
                      title="强行终止该进程"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredProcesses.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-slate-500">
                    没有匹配到相关进程
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
