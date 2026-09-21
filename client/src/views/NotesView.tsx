import React, { useState, useEffect } from 'react';
import { Search, Plus, Copy, Check, Pin, Trash2, PinOff, StickyNote } from 'lucide-react';
import type { NoteItem } from '../types';
import { api } from '../services/api';
import { sound } from '../services/audio';
import { useLang } from '../i18n';

const safeDate = (v: string | null | undefined, fn: (s: string) => string) => {
  if (!v) return '--';
  try { return fn(v); } catch { return v; }
};

export const NotesView: React.FC = () => {
  const { t } = useLang();
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<NoteItem | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pinned, setPinned] = useState(false);

  const fetchNotes = async () => {
    try {
      const data = await api.getNotes();
      setNotes(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { fetchNotes(); }, []);

  const openCreate = () => {
    setEditing(null); setTitle(''); setContent(''); setPinned(false);
    sound.playClick(); setShowModal(true);
  };

  const openEdit = (n: NoteItem) => {
    setEditing(n); setTitle(n.title || ''); setContent(n.content || ''); setPinned(!!n.pinned);
    sound.playClick(); setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      if (editing) {
        const updated = await api.updateNote(editing.id, { title: title.trim(), content: content.trim(), pinned: pinned ? 1 : 0 });
        setNotes(notes.map((n) => (n.id === editing.id ? updated : n)));
      } else {
        const created = await api.createNote({ title: title.trim(), content: content.trim(), pinned: pinned ? 1 : 0 });
        setNotes([created, ...notes]);
      }
      sound.playSuccess(); setShowModal(false);
    } catch (err) { console.error(err); }
  };

  const handleTogglePin = async (n: NoteItem) => {
    try {
      sound.playClick();
      const updated = await api.updateNote(n.id, { pinned: n.pinned ? 0 : 1 });
      setNotes(notes.map((x) => (x.id === n.id ? updated : x)));
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('common.confirm_delete'))) return;
    try { sound.playClick(); await api.deleteNote(id); setNotes(notes.filter((n) => n.id !== id)); }
    catch (err) { console.error(err); }
  };

  const handleCopy = (id: number, text: string) => {
    navigator.clipboard.writeText(text || '');
    sound.playSuccess(); setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = notes.filter((n) => {
    const q = search.toLowerCase();
    return (n.title || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t('notes.search_ph')}
            className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 w-56" />
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-lg shadow-teal-600/30 transition-all cursor-pointer">
          <Plus className="w-4 h-4" /><span>{t('notes.new')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((n) => (
          <div key={n.id} onClick={() => openEdit(n)}
            className="glass-panel p-4 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all space-y-3 cursor-pointer">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <StickyNote className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <h4 className="text-xs font-bold text-white leading-tight truncate">{n.title}</h4>
                {n.pinned ? <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-500/30">{t('notes.pinned_badge')}</span> : null}
              </div>
              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => handleTogglePin(n)} className="p-1 rounded text-slate-500 hover:text-teal-400 transition-colors" title="置顶">
                  {n.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => handleCopy(n.id, `${n.title}\n${n.content || ''}`)}
                  className="p-1 rounded text-slate-500 hover:text-white transition-colors" title="复制">
                  {copiedId === n.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => handleDelete(n.id)} className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors" title="删除">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {n.content && <p className="text-[11px] text-slate-400 leading-normal whitespace-pre-wrap line-clamp-4">{n.content}</p>}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-500">{safeDate(n.updated_at, (s) => s.slice(0, 16))}</span>
              <span className="text-[10px] text-slate-600">{t('notes.click_edit')}</span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="col-span-2 text-center py-16 text-slate-500 text-xs">{t('notes.empty')}</div>}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-slate-700 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-teal-400" />{editing ? t('notes.edit') : t('notes.new')}
            </h3>
            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">{t('kanban.name')}</label>
                <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('notes.title_ph')}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-teal-500" />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">{t('kanban.desc')}</label>
                <textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)}
                  placeholder={t('notes.content_ph')}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 font-mono focus:outline-none focus:border-teal-500 resize-y" />
              </div>
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none">
                <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="accent-teal-500" />
                {t('notes.pinned')}
              </label>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800">{t('common.cancel')}</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold shadow-lg shadow-teal-600/30">{t('common.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
