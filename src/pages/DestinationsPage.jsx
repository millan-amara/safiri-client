import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import ImageGallery from '../components/shared/ImageGallery';
import {
  MapPin, Image, ChevronDown, Edit2, Save, ArrowLeft, Plus,
  Mountain, Palmtree, Building, Trees, Waves, Compass,
} from 'lucide-react';

const typeIcons = { safari: Trees, beach: Waves, city: Building, mountain: Mountain, lake: Waves, cultural: Compass, adventure: Mountain };
const typeColors = { safari: 'bg-green-100 text-green-700', beach: 'bg-blue-100 text-blue-700', city: 'bg-purple-100 text-purple-700', mountain: 'bg-primary/15 text-primary', lake: 'bg-cyan-100 text-cyan-700', cultural: 'bg-pink-100 text-pink-700', adventure: 'bg-orange-100 text-orange-700' };

export default function DestinationsPage() {
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});

  const fetchDestinations = async () => {
    try {
      const { data } = await api.get('/destinations');
      setDestinations(data.destinations);
    } catch (err) { toast.error('Failed to load destinations'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDestinations(); }, []);

  const saveEdit = async (id) => {
    try {
      await api.put(`/destinations/${id}`, {
        ...editForm,
        bestMonths: editForm.bestMonths ? editForm.bestMonths.split(',').map(m => parseInt(m.trim())).filter(Boolean) : [],
        highlights: editForm.highlights ? editForm.highlights.split(',').map(h => h.trim()).filter(Boolean) : [],
      });
      toast.success('Saved');
      setEditing(null);
      fetchDestinations();
    } catch (err) { toast.error('Save failed'); }
  };

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', region: '', type: 'safari', country: 'Kenya', description: '' });
  const [addSaving, setAddSaving] = useState(false);

  const handleAddDestination = async (e) => {
    e.preventDefault();
    if (!addForm.name.trim()) return;
    setAddSaving(true);
    try {
      await api.post('/destinations', addForm);
      toast.success('Destination added');
      setShowAdd(false);
      setAddForm({ name: '', region: '', type: 'safari', country: 'Kenya', description: '' });
      fetchDestinations();
    } catch (err) {
      toast.error('Failed to add');
    } finally {
      setAddSaving(false);
    }
  };

  const inputCls = 'w-full px-2.5 py-1.5 rounded-md bg-background border border-border text-xs focus:outline-none focus:border-primary transition-colors';

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'Playfair Display, serif' }}>Destinations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage destination images and metadata for quotes</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary transition-colors">
          <Plus className="w-4 h-4" /> Add Destination
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAddDestination} className="bg-card rounded-xl border border-border p-5 space-y-3 animate-scale-in">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] text-muted-foreground mb-0.5">Name *</label>
              <input type="text" value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})} className={inputCls} placeholder="e.g. Maasai Mara" required />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-0.5">Region</label>
              <input type="text" value={addForm.region} onChange={e => setAddForm({...addForm, region: e.target.value})} className={inputCls} placeholder="e.g. Rift Valley" />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-0.5">Type</label>
              <select value={addForm.type} onChange={e => setAddForm({...addForm, type: e.target.value})} className={inputCls}>
                {['safari','beach','city','mountain','lake','cultural','adventure'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-0.5">Country</label>
              <input type="text" value={addForm.country} onChange={e => setAddForm({...addForm, country: e.target.value})} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-muted-foreground mb-0.5">Description</label>
            <textarea rows={2} value={addForm.description} onChange={e => setAddForm({...addForm, description: e.target.value})} className={`${inputCls} resize-none`} placeholder="Brief description for quotes..." />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={addSaving} className="px-4 py-1.5 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary disabled:opacity-50">{addSaving ? 'Adding...' : 'Add Destination'}</button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted">Cancel</button>
          </div>
        </form>
      )}

      {/* Empty state */}
      {destinations.length === 0 && !showAdd && (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <MapPin className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground mb-1">No destinations yet</p>
          <p className="text-xs text-muted-foreground mb-4">Add destinations to build your curated image library for quotes.</p>
          <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary transition-colors">
            <Plus className="w-4 h-4" /> Add Your First Destination
          </button>
        </div>
      )}

      <div className="grid gap-3">
        {destinations.map((dest) => {
          const isExpanded = expanded === dest._id;
          const isEditing = editing === dest._id;
          const Icon = typeIcons[dest.type] || MapPin;
          const colorCls = typeColors[dest.type] || 'bg-muted text-muted-foreground';
          const imageCount = dest.images?.length || 0;

          return (
            <div key={dest._id} className={`bg-card rounded-xl border transition-colors ${isExpanded ? 'border-primary/30 shadow-sm' : 'border-border'}`}>
              {/* Header */}
              <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : dest._id)}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorCls}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{dest.name}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${colorCls}`}>{dest.type}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {dest.region && `${dest.region} · `}{dest.country}
                      {imageCount > 0 && ` · ${imageCount} image${imageCount !== 1 ? 's' : ''}`}
                      {dest.averageDaysNeeded && ` · ~${dest.averageDaysNeeded} days`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {imageCount === 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary">Needs images</span>}
                  <ChevronDown className={`w-4 h-4 text-muted-foreground/70 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {/* Expanded */}
              {isExpanded && (
                <div className="border-t border-border p-4 space-y-4">
                  {/* Edit mode */}
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div><label className="block text-[10px] text-muted-foreground mb-0.5">Name</label><input type="text" value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} className={inputCls} /></div>
                        <div><label className="block text-[10px] text-muted-foreground mb-0.5">Region</label><input type="text" value={editForm.region || ''} onChange={e => setEditForm({...editForm, region: e.target.value})} className={inputCls} /></div>
                        <div><label className="block text-[10px] text-muted-foreground mb-0.5">Type</label>
                          <select value={editForm.type || 'safari'} onChange={e => setEditForm({...editForm, type: e.target.value})} className={inputCls}>
                            {['safari','beach','city','mountain','lake','cultural','adventure'].map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                      </div>
                      <div><label className="block text-[10px] text-muted-foreground mb-0.5">Description</label><textarea rows={2} value={editForm.description || ''} onChange={e => setEditForm({...editForm, description: e.target.value})} className={`${inputCls} resize-none`} /></div>
                      <div className="grid grid-cols-3 gap-3">
                        <div><label className="block text-[10px] text-muted-foreground mb-0.5">Avg days needed</label><input type="number" value={editForm.averageDaysNeeded || ''} onChange={e => setEditForm({...editForm, averageDaysNeeded: parseInt(e.target.value) || 0})} className={inputCls} /></div>
                        <div><label className="block text-[10px] text-muted-foreground mb-0.5">Best months (1-12)</label><input type="text" value={editForm.bestMonths || ''} onChange={e => setEditForm({...editForm, bestMonths: e.target.value})} className={inputCls} placeholder="7,8,9,10" /></div>
                        <div><label className="block text-[10px] text-muted-foreground mb-0.5">Highlights</label><input type="text" value={editForm.highlights || ''} onChange={e => setEditForm({...editForm, highlights: e.target.value})} className={inputCls} placeholder="Big 5, Wildebeest" /></div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(dest._id)} className="px-3 py-1.5 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary"><Save className="w-3 h-3 inline mr-1" />Save</button>
                        <button onClick={() => setEditing(null)} className="px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div>
                        {dest.description && <p className="text-xs text-muted-foreground leading-relaxed mb-2">{dest.description}</p>}
                        {dest.highlights?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {dest.highlights.map((h, i) => <span key={i} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">★ {h}</span>)}
                          </div>
                        )}
                        {dest.nearbyDestinations?.length > 0 && (
                          <p className="text-[10px] text-muted-foreground/70">
                            Nearby: {dest.nearbyDestinations.map(n => n.destination?.name || '').filter(Boolean).join(', ')}
                          </p>
                        )}
                      </div>
                      <button onClick={() => { setEditing(dest._id); setEditForm({ name: dest.name, region: dest.region, type: dest.type, description: dest.description, averageDaysNeeded: dest.averageDaysNeeded, bestMonths: dest.bestMonths?.join(', ') || '', highlights: dest.highlights?.join(', ') || '' }); }} className="text-xs text-primary hover:underline flex items-center gap-0.5">
                        <Edit2 className="w-3 h-3" /> Edit
                      </button>
                    </div>
                  )}

                  {/* Image gallery */}
                  <ImageGallery
                    entityType="destination"
                    entityId={dest._id}
                    images={dest.images || []}
                    onUpdated={fetchDestinations}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
