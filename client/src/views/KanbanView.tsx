import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search
} from 'lucide-react';
import type { Task, TaskStatus, TaskPriority } from '../types';
import { api } from '../services/api';
import { sound } from '../services/audio';
import { useLang } from '../i18n';

const COLUMNS: Array<{ id: TaskStatus; titleKey: string; color: string; badgeBg: string }> = [
  { id: 'todo', titleKey: 'kanban.col_todo', color: 'border-slate-700', badgeBg: 'bg-slate-800 text-slate-300' },
  { id: 'in_progress', titleKey: 'kanban.col_progress', color: 'border-indigo-500/50', badgeBg: 'bg-indigo-950 text-indigo-300' },
  { id: 'review', titleKey: 'kanban.col_review', color: 'border-amber-500/50', badgeBg: 'bg-amber-950 text-amber-300' },
  { id: 'done', titleKey: 'kanban.col_done', color: 'border-emerald-500/50', badgeBg: 'bg-emerald-950 text-emerald-300' },
];

export const KanbanView: React.FC = () => {
  const { t } = useLang();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // New task modal state
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');
  const [newCategory, setNewCategory] = useState('Dev');

  const fetchTasks = async () => {
    try {
      const data = await api.getTasks();
      setTasks(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const created = await api.createTask({
        title: newTitle.trim(),
        description: newDesc.trim(),
        priority: newPriority,
        category: newCategory,
        status: 'todo',
      });
      setTasks([created, ...tasks]);
      sound.playSuccess();
      setShowModal(false);
      setNewTitle('');
      setNewDesc('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleMoveStatus = async (task: Task, direction: 'prev' | 'next') => {
    const statusOrder: TaskStatus[] = ['todo', 'in_progress', 'review', 'done'];
    const currentIndex = statusOrder.indexOf(task.status);
    let nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;

    if (nextIndex < 0 || nextIndex >= statusOrder.length) return;
    const nextStatus = statusOrder[nextIndex];

    try {
      const updated = await api.updateTask(task.id, { status: nextStatus });
      setTasks(tasks.map((t) => (t.id === task.id ? updated : t)));
      if (nextStatus === 'done') {
        sound.playSuccess();
      } else {
        sound.playClick();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTask = async (id: number) => {
    if (!confirm(t('common.confirm_delete'))) return;
    try {
      await api.deleteTask(id);
      setTasks(tasks.filter((t) => t.id !== id));
      sound.playClick();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (t.title || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q) ||
      (t.category || '').toLowerCase().includes(q);
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'urgent':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-950/80 text-rose-300 border border-rose-500/30">紧急 Urgent</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-950/80 text-amber-300 border border-amber-500/30">高 High</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-950/80 text-indigo-300 border border-indigo-500/30">中 Medium</span>;
      case 'low':
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">低 Low</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Kanban Topbar: Filters & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 glass-panel p-4 rounded-2xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('kanban.search_ph')}
              className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 w-48"
            />
          </div>

          {/* Priority filter */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2 py-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-transparent text-slate-300 text-xs focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900">{t('kanban.all_priority')}</option>
              <option value="urgent" className="bg-slate-900">紧急 (Urgent)</option>
              <option value="high" className="bg-slate-900">高 (High)</option>
              <option value="medium" className="bg-slate-900">中 (Medium)</option>
              <option value="low" className="bg-slate-900">低 (Low)</option>
            </select>
          </div>
        </div>

        {/* Create Task Button */}
        <button
          onClick={() => {
            sound.playClick();
            setShowModal(true);
          }}
          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t('kanban.new')}</span>
        </button>
      </div>

      {/* 4 Column Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.id);
          return (
            <div
              key={col.id}
              className={`glass-panel rounded-2xl p-4 border flex flex-col min-h-[520px] ${col.color}`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
                <span className="font-semibold text-xs text-slate-200">{t(col.titleKey as any)}</span>
                <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${col.badgeBg}`}>
                  {colTasks.length}
                </span>
              </div>

              {/* Task List */}
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[640px] pr-1">
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    className="glass-card p-3.5 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-all space-y-2.5 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {task.category}
                      </span>
                      {getPriorityBadge(task.priority)}
                    </div>

                    <h4 className="text-xs font-semibold text-white leading-relaxed">
                      {task.title}
                    </h4>

                    {task.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-normal">
                        {task.description}
                      </p>
                    )}

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-slate-500">
                      <span className="text-[10px] font-mono">
                        {(task.created_at || '').slice(5, 16) || '--'}
                      </span>

                      {/* Movement and Action Controls */}
                      <div className="flex items-center gap-1">
                        {col.id !== 'todo' && (
                          <button
                            onClick={() => handleMoveStatus(task, 'prev')}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                            title="移至上一列"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {col.id !== 'done' && (
                          <button
                            onClick={() => handleMoveStatus(task, 'next')}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                            title="移至下一列"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-1 rounded hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 transition-colors"
                          title="删除任务"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {colTasks.length === 0 && (
                  <div className="h-32 flex items-center justify-center border border-dashed border-slate-800 rounded-xl text-[11px] text-slate-500">
                    {t('kanban.empty_col')}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* New Task Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-slate-700 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-400" />
              {t('kanban.create_title')}
            </h3>

            <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">{t('kanban.name')}</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="例如：重构 API 鉴权机制..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">{t('kanban.desc')}</label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="详细信息、验收条件..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">优先级</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="low">低 (Low)</option>
                    <option value="medium">中 (Medium)</option>
                    <option value="high">高 (High)</option>
                    <option value="urgent">紧急 (Urgent)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">类别分类</label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Dev, DevOps, Bug..."
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
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
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/30"
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
