import { useState, useEffect } from 'react';
import api from '../utils/api';
import { cldThumb } from '../utils/helpers';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { Upload, Trash2, Image as ImageIcon, Search, Link as LinkIcon, Check, X, Pencil } from 'lucide-react';

const TYPES = ['other', 'safari', 'beach', 'city', 'mountain', 'lake', 'cultural', 'adventure'];

export default function LibraryAdminPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ q: '', type: '' });

  const [form, setForm] = useState({ mode: 'file', url: '', tags: '', caption: '', credit: '', sourceUrl: '', destinationType: 'other' });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ tags: '', caption: '', credit: '', destinationType: 'other' });
  const [editSaving, setEditSaving] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter.q) params.q = filter.q;
      if (filter.type) params.type = filter.type;
      const { data } = await api.get('/library/admin', { params });
      setItems(data);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchItems(); }, []);

  // Parse Unsplash's "copy credit" HTML snippet into plain-text credit + photo URL.
  // Example input: Photo by <a href="…photographer…">Name</a> on <a href="…photo…">Unsplash</a>
  const parseCredit = (raw) => {
    if (!raw || !/<a\s/i.test(raw)) return { credit: raw, sourceUrl: '' };
    const div = document.createElement('div');
    div.innerHTML = raw;
    const links = div.querySelectorAll('a');
    const photoHref = links[links.length - 1]?.getAttribute('href') || '';
    return { credit: div.textContent.trim(), sourceUrl: photoHref };
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.mode === 'file' && !file) return toast.error('Pick a file');
    if (form.mode === 'url' && !form.url.trim()) return toast.error('Enter a URL');
    const parsed = parseCredit(form.credit);
    const credit = parsed.credit;
    const sourceUrl = form.sourceUrl || parsed.sourceUrl;
    setSaving(true);
    try {
      const fd = new FormData();
      if (form.mode === 'file') fd.append('image', file);
      if (form.mode === 'url') fd.append('url', form.url);
      fd.append('tags', form.tags);
      fd.append('caption', form.caption);
      fd.append('credit', credit);
      fd.append('sourceUrl', sourceUrl);
      fd.append('destinationType', form.destinationType);
      await api.post('/library/admin', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Added');
      setForm({ mode: form.mode, url: '', tags: '', caption: '', credit: '', sourceUrl: '', destinationType: 'other' });
      setFile(null);
      fetchItems();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Upload failed');
    } finally { setSaving(false); }
  };

  const toggleActive = async (item) => {
    try {
      await api.put(`/library/admin/${item._id}`, { isActive: !item.isActive });
      fetchItems();
    } catch { toast.error('Update failed'); }
  };

  const startEdit = (item) => {
    setEditingId(item._id);
    setEditForm({
      tags: (item.tags || []).join(', '),
      caption: item.caption || '',
      credit: item.credit || '',
      destinationType: item.destinationType || 'other',
    });
  };

  const cancelEdit = () => { setEditingId(null); };

  const saveEdit = async (id) => {
    setEditSaving(true);
    try {
      await api.put(`/library/admin/${id}`, editForm);
      toast.success('Updated');
      setEditingId(null);
      fetchItems();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Update failed');
    } finally { setEditSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this image from the library?')) return;
    try {
      await api.delete(`/library/admin/${id}`);
      toast.success('Deleted');
      fetchItems();
    } catch { toast.error('Delete failed'); }
  };

  if (!user?.isSuperAdmin) {
    return <div className="p-8 text-sm text-muted-foreground">Superadmin access required.</div>;
  }

  const inputCls = 'w-full px-2.5 py-1.5 rounded-md bg-background border border-border text-xs focus:outline-none focus:border-primary';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground" style={{ fontFamily: 'Playfair Display, serif' }}>Image Library</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Curated stock imagery shared across all organizations</p>
      </div>

      {/* Add form */}
      <form onSubmit={submit} className="bg-card border border-border rounded-lg p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <button type="button" onClick={() => setForm(f => ({ ...f, mode: 'file' }))}
            className={`px-3 py-1.5 rounded-md border ${form.mode === 'file' ? 'bg-primary text-white border-primary' : 'border-border'}`}>
            <Upload className="w-3 h-3 inline mr-1" /> Upload
          </button>
          <button type="button" onClick={() => setForm(f => ({ ...f, mode: 'url' }))}
            className={`px-3 py-1.5 rounded-md border ${form.mode === 'url' ? 'bg-primary text-white border-primary' : 'border-border'}`}>
            <LinkIcon className="w-3 h-3 inline mr-1" /> From URL
          </button>
        </div>

        {form.mode === 'file' ? (
          <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} className={inputCls} />
        ) : (
          <input type="url" placeholder="https://images.unsplash.com/..." value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} className={inputCls} />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input placeholder="Tags (comma-separated, e.g. nairobi, kenya, city)" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} className={inputCls} />
          <select value={form.destinationType} onChange={e => setForm({ ...form, destinationType: e.target.value })} className={inputCls}>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input placeholder="Caption" value={form.caption} onChange={e => setForm({ ...form, caption: e.target.value })} className={inputCls} />
          <input placeholder="Credit — e.g. “Photo by Jane Doe on Pexels” (or paste Unsplash snippet)" value={form.credit} onChange={e => setForm({ ...form, credit: e.target.value })} className={inputCls} />
          <input placeholder="Source URL (link to original)" value={form.sourceUrl} onChange={e => setForm({ ...form, sourceUrl: e.target.value })} className={`${inputCls} sm:col-span-2`} />
        </div>

        <button type="submit" disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
          <Upload className="w-4 h-4" /> {saving ? 'Saving…' : 'Add to library'}
        </button>
      </form>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            placeholder="Search tags…"
            value={filter.q}
            onChange={e => setFilter({ ...filter, q: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && fetchItems()}
            className={`${inputCls} pl-8`}
          />
        </div>
        <select value={filter.type} onChange={e => setFilter({ ...filter, type: e.target.value })} className={inputCls + ' w-auto shrink-0'}>
          <option value="">All types</option>
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={fetchItems} className="px-3 py-1.5 rounded-md border border-border text-xs shrink-0">Apply</button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No library images yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map(item => (
            <div key={item._id} className="bg-card border border-border rounded-lg overflow-hidden group relative">
              <div className="aspect-video bg-muted">
                <img src={cldThumb(item.url, 500)} alt={item.caption} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              </div>
              <div className="p-2 space-y-1">
                {editingId === item._id ? (
                  <div className="space-y-1.5">
                    <input
                      placeholder="Tags (comma-separated)"
                      value={editForm.tags}
                      onChange={e => setEditForm({ ...editForm, tags: e.target.value })}
                      className="w-full px-2 py-1 rounded bg-background border border-border text-[11px] focus:outline-none focus:border-primary"
                    />
                    <input
                      placeholder="Caption"
                      value={editForm.caption}
                      onChange={e => setEditForm({ ...editForm, caption: e.target.value })}
                      className="w-full px-2 py-1 rounded bg-background border border-border text-[11px] focus:outline-none focus:border-primary"
                    />
                    <input
                      placeholder="Credit"
                      value={editForm.credit}
                      onChange={e => setEditForm({ ...editForm, credit: e.target.value })}
                      className="w-full px-2 py-1 rounded bg-background border border-border text-[11px] focus:outline-none focus:border-primary"
                    />
                    <select
                      value={editForm.destinationType}
                      onChange={e => setEditForm({ ...editForm, destinationType: e.target.value })}
                      className="w-full px-2 py-1 rounded bg-background border border-border text-[11px] focus:outline-none focus:border-primary"
                    >
                      {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <div className="flex gap-1 pt-1">
                      <button onClick={() => saveEdit(item._id)} disabled={editSaving}
                        className="flex-1 py-1 rounded bg-primary text-white text-[11px] font-medium hover:opacity-90 disabled:opacity-50">
                        {editSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button onClick={cancelEdit} disabled={editSaving}
                        className="flex-1 py-1 rounded border border-border text-[11px] font-medium hover:bg-muted">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-1">
                      {item.tags.slice(0, 4).map(t => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 bg-muted rounded">{t}</span>
                      ))}
                    </div>
                    {item.caption && <p className="text-xs truncate">{item.caption}</p>}
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{item.destinationType} · used {item.usageCount}×</span>
                      <div className="flex gap-1">
                        <button onClick={() => startEdit(item)} title="Edit tags/caption"
                          className="p-1 hover:bg-muted rounded">
                          <Pencil className="w-3 h-3 text-muted-foreground" />
                        </button>
                        <button onClick={() => toggleActive(item)} title={item.isActive ? 'Deactivate' : 'Activate'}
                          className="p-1 hover:bg-muted rounded">
                          {item.isActive ? <Check className="w-3 h-3 text-green-600" /> : <X className="w-3 h-3 text-muted-foreground" />}
                        </button>
                        <button onClick={() => remove(item._id)} className="p-1 hover:bg-muted rounded">
                          <Trash2 className="w-3 h-3 text-red-600" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
