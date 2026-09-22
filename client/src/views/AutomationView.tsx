import React, { useState, useEffect } from 'react';
import {
  Play,
  Plus,
  Pencil,
  Trash2,
  Terminal,
  CheckCircle2,
  XCircle,
  Command
} from 'lucide-react';
import type { ScriptItem } from '../types';
import { api } from '../services/api';
import { sound } from '../services/audio';
import { useLang } from '../i18n';

export const AutomationView: React.FC = () => {
  const { t } = useLang();
  const [scripts, setScripts] = useState<ScriptItem[]>([]);
  const [runningId, setRunningId] = useState<number | null>(null);
  const [activeOutput, setActiveOutput] = useState<{ id: number; title: string; output: string; status: string } | null>(null);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ScriptItem | null>(null);
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [category, setCategory] = useState('Dev');
  const [desc, setDesc] = useState('');

  const openCreate = () => {
    setEditing(null); setName(''); setCommand(''); setCategory('Dev'); setDesc('');
    sound.playClick(); setShowModal(true);
  };

  const openEdit = (s: ScriptItem) => {
    setEditing(s); setName(s.name || ''); setCommand(s.command || '');
    setCategory(s.category || 'Dev'); setDesc(s.description || '');
    sound.playClick(); setShowModal(true);
  };

  const fetchScripts = async () => {
    try {
      const data = await api.getScripts();
      setScripts(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchScripts();
  }, []);

  const handleRunScript = async (script: ScriptItem) => {
    try {
      setRunningId(script.id);
      sound.playClick();
      const res = await api.runScript(script.id);
      if (res.success) {
        sound.playSuccess();
      }

      setActiveOutput({
        id: script.id,
        title: script.name,
        output: res.stdout || res.stderr || '执行成功，无额外输出。',
        status: res.status,
      });

      fetchScripts();
    } catch (err: any) {
      setActiveOutput({
        id: script.id,
        title: script.name,
        output: err.message,
        status: 'failed',
      });
    } finally {
      setRunningId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('common.confirm_delete'))) return;
    try {
      sound.playClick();
      await api.deleteScript(id);
      setScripts(scripts.filter((s) => s.id !== id));
      if (activeOutput?.id === id) setActiveOutput(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveScript = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !command.trim()) return;

    try {
      if (editing) {
        const updated = await api.updateScript(editing.id, {
          name: name.trim(),
          command: command.trim(),
          category: category.trim(),
          description: desc.trim(),
        });
        setScripts(scripts.map((s) => (s.id === editing.id ? updated : s)));
      } else {
        const created = await api.createScript({
          name: name.trim(),
          command: command.trim(),
          category: category.trim(),
          description: desc.trim(),
        });
        setScripts([...scripts, created]);
      }
      sound.playSuccess();
      setShowModal(false);
      setEditing(null);
      setName('');
      setCommand('');
      setDesc('');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Toolbar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Command className="w-4 h-4 text-blue-400" />
            自动化运维与系统工作流
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            单键触发常用 Bash 脚本与系统巡检任务，支持超时安全隔离。
          </p>
        </div>

        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t('auto.new')}</span>
        </button>
      </div>

      {/* Grid of Scripts & Output Window */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scripts List */}
        <div className="space-y-3">
          {scripts.map((item) => {
            const isRunning = runningId === item.id;
            return (
              <div
                key={item.id}
                className="glass-panel p-4 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-blue-300">
                        {item.category}
                      </span>
                      <h4 className="text-xs font-bold text-white">{item.name}</h4>
                    </div>
                    {item.description && (
                      <p className="text-[11px] text-slate-400 mt-1">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRunScript(item)}
                      disabled={isRunning}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/90 hover:bg-blue-600 text-white font-mono text-xs font-semibold shadow-md transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : 'fill-white'}`} />
                      <span>{isRunning ? 'Running...' : t('auto.run')}</span>
                    </button>

                    <button
                      onClick={() => openEdit(item)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-slate-800"
                      title={t('common.edit')}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800"
                      title={t('common.delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Command preview */}
                <div className="p-2.5 bg-slate-950 rounded-xl font-mono text-[11px] text-slate-300 border border-slate-800/80 truncate">
                  $ {item.command}
                </div>

                {/* Status bar */}
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-800/60">
                  <span>最后执行: {item.last_run || '未运行'}</span>
                  {item.last_status && (
                    <span
                      className={`flex items-center gap-1 ${
                        item.last_status === 'success' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {item.last_status === 'success' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {item.last_status}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Execution Console */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col h-[560px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs text-slate-400 mb-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blue-400" />
              <span className="font-semibold text-slate-200">
                {activeOutput ? `输出: ${activeOutput.title}` : '任务执行输出控制台'}
              </span>
            </div>
            {activeOutput && (
              <span
                className={`font-mono text-[10px] px-2 py-0.5 rounded ${
                  activeOutput.status === 'success' ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'
                }`}
              >
                {activeOutput.status}
              </span>
            )}
          </div>

          <div className="flex-1 bg-black/90 p-4 rounded-xl font-mono text-xs text-slate-200 overflow-y-auto border border-slate-800/80">
            {activeOutput ? (
              <pre className="whitespace-pre-wrap leading-relaxed">
                {activeOutput.output}
              </pre>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600 italic">
                点击左侧任意脚本的「运行」按钮以在此处捕获标准输出
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-slate-700 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              {editing ? <Pencil className="w-4 h-4 text-blue-400" /> : <Plus className="w-4 h-4 text-blue-400" />}
              {editing ? t('auto.edit_title') : t('auto.new')}
            </h3>

            <form onSubmit={handleSaveScript} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">脚本名称 *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：系统缓存清理"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">分类</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="System, Dev, Docker..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Bash 命令语句 *</label>
                <textarea
                  rows={3}
                  required
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="sync && echo 3 > /proc/sys/vm/drop_caches"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 font-mono focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">说明备注</label>
                <input
                  type="text"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="脚本的作用及影响..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/30"
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
