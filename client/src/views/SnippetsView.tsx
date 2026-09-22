import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Copy,
  Check,
  Star,
  Pencil,
  Trash2,
  Tag
} from 'lucide-react';
import type { Snippet } from '../types';
import { api } from '../services/api';
import { sound } from '../services/audio';
import { useLang } from '../i18n';

export const SnippetsView: React.FC = () => {
  const { t } = useLang();
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Snippet | null>(null);
  const [title, setTitle] = useState('');
  const [lang, setLang] = useState('bash');
  const [code, setCode] = useState('');
  const [tags, setTags] = useState('');
  const [desc, setDesc] = useState('');

  const openCreate = () => {
    setEditing(null); setTitle(''); setLang('bash'); setCode(''); setTags(''); setDesc('');
    sound.playClick(); setShowModal(true);
  };

  const openEdit = (s: Snippet) => {
    setEditing(s); setTitle(s.title || ''); setLang(s.language || 'bash');
    setCode(s.code || ''); setTags(s.tags || ''); setDesc(s.description || '');
    sound.playClick(); setShowModal(true);
  };

  const fetchSnippets = async () => {
    try {
      const data = await api.getSnippets();
      setSnippets(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSnippets();
  }, []);

  const handleCopy = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    sound.playSuccess();
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleFavorite = async (s: Snippet) => {
    try {
      sound.playClick();
      const updated = await api.updateSnippet(s.id, { is_favorite: s.is_favorite ? 0 : 1 });
      setSnippets(snippets.map((item) => (item.id === s.id ? updated : item)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('common.confirm_delete'))) return;
    try {
      sound.playClick();
      await api.deleteSnippet(id);
      setSnippets(snippets.filter((s) => s.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSnippet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !code.trim()) return;

    try {
      if (editing) {
        const updated = await api.updateSnippet(editing.id, {
          title: title.trim(),
          language: lang,
          code: code.trim(),
          tags: tags.trim(),
          description: desc.trim(),
        });
        setSnippets(snippets.map((item) => (item.id === editing.id ? updated : item)));
      } else {
        const created = await api.createSnippet({
          title: title.trim(),
          language: lang,
          code: code.trim(),
          tags: tags.trim(),
          description: desc.trim(),
        });
        setSnippets([created, ...snippets]);
      }
      sound.playSuccess();
      setShowModal(false);
      setEditing(null);
      setTitle('');
      setCode('');
      setTags('');
      setDesc('');
    } catch (err) {
      console.error(err);
    }
  };

  // Collect all unique tags
  const allTags = Array.from(
    new Set(
      snippets
        .flatMap((s) => (s.tags || '').split(','))
        .map((t) => t.trim())
        .filter(Boolean)
    )
  );

  const filteredSnippets = snippets.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch =
      (s.title || '').toLowerCase().includes(q) ||
      (s.code || '').toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q);
    const matchesTag = !selectedTag || (s.tags || '').split(',').map((t) => t.trim()).includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  return (
    <div className="space-y-6">
      {/* Top Filter & Add Toolbar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('snippets.search_ph')}
              className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 w-56"
            />
          </div>

          {/* Tag Pills */}
          <div className="flex items-center gap-1 overflow-x-auto py-1 max-w-md">
            <button
              onClick={() => setSelectedTag(null)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                selectedTag === null
                ? 'bg-indigo-600 text-white font-semibold'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('snippets.all')}
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1 ${
                  selectedTag === tag
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Add Snippet Button */}
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-lg shadow-amber-600/30 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t('snippets.new')}</span>
        </button>
      </div>

      {/* Snippets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredSnippets.map((s) => (
          <div
            key={s.id}
            className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-all space-y-3"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 uppercase font-semibold">
                    {s.language}
                  </span>
                  <h4 className="text-xs font-bold text-white leading-tight">{s.title}</h4>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleFavorite(s)}
                    className="p-1 rounded text-slate-500 hover:text-amber-400 transition-colors"
                    title="收藏"
                  >
                    <Star className={`w-3.5 h-3.5 ${s.is_favorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                  </button>
                  <button
                    onClick={() => openEdit(s)}
                    className="p-1 rounded text-slate-500 hover:text-blue-400 transition-colors"
                    title={t('common.edit')}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                    title={t('common.delete')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {s.description && (
                <p className="text-[11px] text-slate-400 mt-1.5 leading-normal">
                  {s.description}
                </p>
              )}

              {/* Code Box */}
              <div className="mt-3 relative group">
                <pre className="p-3 bg-slate-950 rounded-xl font-mono text-[11px] text-slate-300 overflow-x-auto border border-slate-800/80 max-h-40">
                  {s.code}
                </pre>

                <button
                  onClick={() => handleCopy(s.id, s.code)}
                  className="absolute right-2 top-2 p-1.5 rounded-lg bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-white hover:bg-indigo-600 transition-all shadow-md"
                  title="一键复制"
                >
                  {copiedId === s.id ? (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-sans">
                      <Check className="w-3 h-3" /> 已复制
                    </span>
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Tags footer */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <div className="flex flex-wrap gap-1">
                {(s.tags || '').split(',').filter(Boolean).map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800"
                  >
                    #{tag.trim()}
                  </span>
                ))}
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                {(s.created_at || '').slice(0, 10) || '--'}
              </span>
            </div>
          </div>
        ))}

        {filteredSnippets.length === 0 && (
          <div className="col-span-2 text-center py-16 text-slate-500 text-xs">
            {t('snippets.empty')}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-slate-700 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              {editing ? <Pencil className="w-4 h-4 text-amber-400" /> : <Plus className="w-4 h-4 text-amber-400" />}
              {editing ? t('snippets.edit_title') : t('snippets.new')}
            </h3>

            <form onSubmit={handleSaveSnippet} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">标题 *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例如：Git 取消上一次 Commit"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">编程语言</label>
                  <select
                    value={lang}
                    onChange={(e) => setLang(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  >
                    <option value="bash">Bash / Shell</option>
                    <option value="python">Python</option>
                    <option value="javascript">JavaScript</option>
                    <option value="typescript">TypeScript</option>
                    <option value="sql">SQL</option>
                    <option value="dockerfile">Dockerfile</option>
                    <option value="json">JSON</option>
                    <option value="text">纯文本</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">标签 (逗号分隔)</label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="git, cli, debug"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">代码内容 *</label>
                <textarea
                  rows={4}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="在此输入代码..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 font-mono focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">补充说明</label>
                <input
                  type="text"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="该片段的用途与注意事项..."
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
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-lg shadow-amber-600/30"
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
