import { useState, useRef } from 'react';
import Modal from '../shared/Modal';
import ImageGallery from '../shared/ImageGallery';
import RateListEditor, { emptyList } from './hotel/RateListEditor';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, UploadCloud, Loader2, AlertTriangle, X } from 'lucide-react';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'KES', 'TZS', 'UGX', 'RWF', 'ZAR'];
const HOTEL_TYPES = ['hotel', 'lodge', 'tented_camp', 'resort', 'villa', 'apartment', 'guesthouse', 'conservancy_camp'];

const inputCls = 'w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-1';

export default function HotelModal({ hotel, onClose, onSaved }) {
  const isEdit = !!hotel?._id;
  const { refreshOrganization } = useAuth();
  const [tab, setTab] = useState('basics'); // basics | rates | images
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [images, setImages] = useState(hotel?.images || []);
  const [extractWarnings, setExtractWarnings] = useState([]);
  // Extra hotels returned from a multi-hotel PDF that the user hasn't yet
  // loaded into this form or saved as separate records.
  const [pendingOtherHotels, setPendingOtherHotels] = useState([]);
  const [batchSaving, setBatchSaving] = useState(false);
  const pdfInputRef = useRef(null);

  const [form, setForm] = useState({
    name: hotel?.name || '',
    destination: hotel?.destination || '',
    location: hotel?.location || '',
    stars: hotel?.stars || 3,
    type: hotel?.type || 'hotel',
    description: hotel?.description || '',
    currency: hotel?.currency || 'USD',
    tags: hotel?.tags?.join(', ') || '',
    amenities: hotel?.amenities?.join(', ') || '',
    notes: hotel?.notes || '',
    contactEmail: hotel?.contactEmail || '',
    contactPhone: hotel?.contactPhone || '',
    // Start empty — operator either clicks "Add Rate List" for manual entry
    // or uses PDF import. No auto-seeded placeholder to delete later.
    rateLists: hotel?.rateLists?.length ? hotel.rateLists : [],
  });

  const updateList = (idx, list) => {
    const rateLists = [...form.rateLists];
    rateLists[idx] = list;
    setForm({ ...form, rateLists });
  };
  const addList = () => setForm({ ...form, rateLists: [...form.rateLists, emptyList()] });
  const removeList = (idx) => {
    setForm({ ...form, rateLists: form.rateLists.filter((_, i) => i !== idx) });
  };
  const duplicateList = (idx) => {
    const copy = JSON.parse(JSON.stringify(form.rateLists[idx]));
    copy.name = copy.name + ' (copy)';
    setForm({ ...form, rateLists: [...form.rateLists, copy] });
  };

  // PDF → Claude → draft structure. We merge the extracted fields into the
  // current form: basics overwrite only if currently empty (so we don't
  // clobber something the operator just typed), and rate lists are APPENDED
  // to whatever they already have. They can then prune/edit in the tabs.
  // Reshape a raw extracted hotel into form-friendly values (ISO dates → YYYY-MM-DD).
  const shapeExtractedHotel = (d) => ({
    ...d,
    rateLists: (d.rateLists || []).map(list => ({
      ...emptyList(),
      ...list,
      validFrom: list.validFrom ? String(list.validFrom).slice(0, 10) : '',
      validTo: list.validTo ? String(list.validTo).slice(0, 10) : '',
      seasons: (list.seasons || []).map(s => ({
        ...s,
        dateRanges: (s.dateRanges || []).map(r => ({
          from: r.from ? String(r.from).slice(0, 10) : '',
          to: r.to ? String(r.to).slice(0, 10) : '',
        })),
        specificDates: (s.specificDates || []).map(x => x ? String(x).slice(0, 10) : '').filter(Boolean),
        rooms: s.rooms || [],
        supplements: (s.supplements || []).map(sup => ({
          ...sup,
          dates: (sup.dates || []).map(dr => ({
            from: dr.from ? String(dr.from).slice(0, 10) : '',
            to: dr.to ? String(dr.to).slice(0, 10) : '',
          })),
        })),
      })),
    })),
  });

  // Load ONE extracted hotel into the current form. Basics fill only if the
  // corresponding form field is blank — never clobber operator-typed data.
  // Amenities and tags union with whatever's already there (deduped). Rate
  // lists always append. If the PDF was an info-only sheet (no rate lists),
  // the form lands on the Basics tab instead of jumping to Rates.
  const loadExtractedIntoForm = (d) => {
    const hasRates = (d.rateLists || []).length > 0;
    const prevAmenities = form.amenities ? form.amenities.split(',').map(s => s.trim()).filter(Boolean) : [];
    const newAmenities = Array.isArray(d.amenities) ? d.amenities : (d.amenities ? String(d.amenities).split(',').map(s => s.trim()) : []);
    const mergedAmenities = Array.from(new Set([...prevAmenities, ...newAmenities])).join(', ');

    const prevTags = form.tags ? form.tags.split(',').map(s => s.trim()).filter(Boolean) : [];
    const newTags = Array.isArray(d.tags) ? d.tags : (d.tags ? String(d.tags).split(',').map(s => s.trim()) : []);
    const mergedTags = Array.from(new Set([...prevTags, ...newTags])).join(', ');

    setForm(prev => ({
      ...prev,
      name: prev.name || d.name || '',
      destination: prev.destination || d.destination || '',
      location: prev.location || d.location || '',
      stars: prev.stars || d.stars || 3,
      type: prev.type || d.type || 'hotel',
      description: prev.description || d.description || '',
      currency: prev.currency || d.currency || 'USD',
      contactEmail: prev.contactEmail || d.contactEmail || '',
      contactPhone: prev.contactPhone || d.contactPhone || '',
      amenities: mergedAmenities,
      tags: mergedTags,
      rateLists: [...(prev.rateLists || []), ...(d.rateLists || [])],
    }));
    setTab(hasRates ? 'rates' : 'basics');
  };

  const handlePdfPick = () => pdfInputRef.current?.click();
  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf') { toast.error('Please upload a PDF'); return; }
    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (form.destination) fd.append('destination', form.destination);
      const { data } = await api.post('/partners/hotels/extract-pdf', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const drafts = (data.drafts || []).map(shapeExtractedHotel);
      const warnings = data.warnings || [];
      setExtractWarnings(warnings);

      if (drafts.length === 0) {
        toast.error('No hotels found in the PDF.');
        return;
      }

      if (drafts.length === 1) {
        const d = drafts[0];
        loadExtractedIntoForm(d);
        if (warnings.length) {
          toast(`Extracted with ${warnings.length} warning(s) — see banner above the form`, { icon: '⚠️', duration: 6000 });
        } else {
          const rateCount = (d.rateLists || []).length;
          if (rateCount > 0) {
            toast.success(`Extracted ${rateCount} rate list(s). Review and save.`);
          } else {
            // Info/T&C-only document — describe what we actually pulled in.
            const bits = [];
            if (d.description) bits.push('description');
            if ((d.amenities || []).length) bits.push(`${(d.amenities || []).length} amenities`);
            toast.success(bits.length ? `Extracted ${bits.join(' + ')} into Basics tab.` : 'No rate or property data found in this PDF.');
          }
        }
        return;
      }

      // Multiple hotels: load the first one into the current form, keep the
      // rest as "pending" so the operator can choose what to do with them.
      loadExtractedIntoForm(drafts[0]);
      setPendingOtherHotels(drafts.slice(1));
      toast(`Found ${drafts.length} hotels — "${drafts[0].name}" loaded here. See banner for the other ${drafts.length - 1}.`, { icon: '📑', duration: 7000 });
    } catch (err) {
      toast.error(err.response?.data?.message || 'PDF extraction failed');
    } finally {
      setExtracting(false);
      // AI credits are auto-refunded server-side on any non-2xx response
      // (see middleware/subscription.js). Refresh the cached org so the UI
      // balance reflects either the spend (on success) or the refund (on failure).
      refreshOrganization();
    }
  };

  // Swap the currently-loaded hotel with a pending one. The current form's
  // data goes back into the pending list so nothing is lost if the operator
  // clicks through several options.
  const swapToPending = (idx) => {
    const picked = pendingOtherHotels[idx];
    const currentSnapshot = {
      name: form.name,
      destination: form.destination,
      location: form.location,
      stars: form.stars,
      type: form.type,
      description: form.description,
      currency: form.currency,
      rateLists: form.rateLists,
    };
    setPendingOtherHotels(prev => [
      ...prev.slice(0, idx),
      currentSnapshot,
      ...prev.slice(idx + 1),
    ]);
    setForm(prevForm => ({
      ...prevForm,
      name: picked.name || '',
      destination: picked.destination || '',
      location: picked.location || '',
      stars: picked.stars || 3,
      type: picked.type || 'hotel',
      description: picked.description || '',
      currency: picked.currency || 'USD',
      rateLists: picked.rateLists || [],
    }));
    toast.success(`Loaded "${picked.name}" into the form`);
  };

  const dismissPending = (idx) => {
    setPendingOtherHotels(prev => prev.filter((_, i) => i !== idx));
  };

  // POST each remaining pending hotel as a new record and clear the queue.
  const saveAllPending = async () => {
    if (!pendingOtherHotels.length) return;
    setBatchSaving(true);
    try {
      for (const d of pendingOtherHotels) {
        const payload = {
          name: d.name || 'Untitled Hotel',
          destination: d.destination || form.destination || '',
          location: d.location || '',
          stars: d.stars || 3,
          type: d.type || 'hotel',
          description: d.description || '',
          currency: d.currency || 'USD',
          rateLists: (d.rateLists || []).map(normalizeList),
        };
        await api.post('/partners/hotels', payload);
      }
      toast.success(`Saved ${pendingOtherHotels.length} additional hotel(s)`);
      setPendingOtherHotels([]);
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save remaining hotels');
    } finally {
      setBatchSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.destination) { toast.error('Name and destination are required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        amenities: form.amenities ? form.amenities.split(',').map(t => t.trim()).filter(Boolean) : [],
        rateLists: form.rateLists.map(normalizeList),
      };
      if (isEdit) {
        await api.put(`/partners/hotels/${hotel._id}`, payload);
        toast.success('Hotel updated');
      } else {
        await api.post('/partners/hotels', payload);
        toast.success('Hotel added');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? 'Edit Hotel' : 'Add Hotel'} onClose={onClose} xwide persistent>
      <form onSubmit={handleSubmit} className="space-y-4">
        {pendingOtherHotels.length > 0 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-blue-900">
                  {pendingOtherHotels.length} more hotel{pendingOtherHotels.length === 1 ? '' : 's'} found in the PDF
                </p>
                <p className="text-[11px] text-blue-800/80 mt-0.5">
                  Click a name to swap it into this form (the current hotel will swap into the list). Or save them all as separate hotels now.
                </p>
                <ul className="mt-2 space-y-1">
                  {pendingOtherHotels.map((h, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => swapToPending(i)}
                        className="flex-1 text-left px-2 py-1 rounded bg-white border border-blue-200 text-blue-900 hover:border-blue-400 transition-colors"
                      >
                        <span className="font-medium">{h.name || 'Untitled hotel'}</span>
                        {h.destination && <span className="text-blue-700/70"> · {h.destination}</span>}
                        <span className="text-blue-700/60 ml-1">· {(h.rateLists || []).length} rate list{(h.rateLists || []).length === 1 ? '' : 's'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => dismissPending(i)}
                        className="p-1 rounded text-blue-700/60 hover:text-red-500"
                        title="Discard this hotel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    onClick={saveAllPending}
                    disabled={batchSaving}
                    className="px-3 py-1 rounded bg-blue-600 text-white text-[11px] font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {batchSaving ? 'Saving…' : `Save all ${pendingOtherHotels.length} as new hotels`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingOtherHotels([])}
                    className="px-3 py-1 rounded bg-white border border-blue-200 text-blue-700 text-[11px] font-medium hover:border-blue-400 transition-colors"
                  >
                    Dismiss all
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {extractWarnings.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-900">
                  PDF extraction returned {extractWarnings.length} warning{extractWarnings.length === 1 ? '' : 's'}
                </p>
                <p className="text-[11px] text-amber-800/80 mt-0.5">
                  Review and fix each item in the Rate Lists tab before saving.
                </p>
                <ul className="mt-2 space-y-1">
                  {extractWarnings.map((w, i) => (
                    <li key={i} className="text-[11px] text-amber-900 flex items-start gap-1.5">
                      <span className="text-amber-600 shrink-0">•</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                onClick={() => setExtractWarnings([])}
                className="p-1 rounded hover:bg-amber-100 text-amber-700 shrink-0"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border">
          {[
            { id: 'basics', label: 'Basics' },
            { id: 'rates', label: `Rate Lists (${form.rateLists.length})` },
            { id: 'images', label: 'Images', edit: true },
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              disabled={t.edit && !isEdit}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              title={t.edit && !isEdit ? 'Save the hotel first, then upload images' : ''}
            >
              {t.label}
            </button>
          ))}
          <button
            type="button"
            onClick={handlePdfPick}
            disabled={extracting}
            className="ml-auto px-3 py-1.5 text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {extracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
            {extracting ? 'Extracting…' : 'Import rates from PDF'}
          </button>
          <input ref={pdfInputRef} type="file" accept="application/pdf" onChange={handlePdfUpload} className="hidden" />
        </div>

        {tab === 'basics' && (
          <BasicsTab form={form} setForm={setForm} />
        )}

        {tab === 'rates' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Each rate list is one price sheet (Rack / STO / Resident / a promo). The quote engine picks the best match based on trip dates and client type.
              </p>
              <button type="button" onClick={addList} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add Rate List
              </button>
            </div>
            {form.rateLists.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <p className="text-sm font-medium text-foreground">No rate lists yet</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  Add one manually, or click "Import rates from PDF" above to extract from a supplier rate card.
                </p>
                <button type="button" onClick={addList} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add Rate List
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {form.rateLists.map((list, i) => (
                  <RateListEditor
                    key={i}
                    list={list}
                    index={i}
                    onChange={(updated) => updateList(i, updated)}
                    onRemove={() => removeList(i)}
                    onDuplicate={() => duplicateList(i)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'images' && isEdit && (
          <ImageGallery
            entityType="hotel"
            entityId={hotel._id}
            images={images}
            onUpdated={async () => {
              try {
                const { data } = await api.get(`/partners/hotels/${hotel._id}`);
                setImages(data.images || []);
              } catch (err) { /* silent */ }
              onSaved();
            }}
          />
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
          <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary transition-colors disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Update Hotel' : 'Add Hotel'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function BasicsTab({ form, setForm }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Hotel Name *</label>
          <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} required />
        </div>
        <div>
          <label className={labelCls}>Destination *</label>
          <input type="text" value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} className={inputCls} placeholder="e.g. Maasai Mara" required />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className={labelCls}>Location</label>
          <input type="text" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className={inputCls} placeholder="e.g. Talek" />
        </div>
        <div>
          <label className={labelCls}>Stars</label>
          <select value={form.stars} onChange={e => setForm({ ...form, stars: parseInt(e.target.value) })} className={inputCls}>
            {[1, 2, 3, 4, 5].map(s => <option key={s} value={s}>{s} Star</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Type</label>
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={inputCls}>
            {HOTEL_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Display Currency</label>
          <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className={inputCls}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <p className="text-[10px] text-muted-foreground mt-1">Individual rate lists can override this.</p>
        </div>
      </div>

      <div>
        <label className={labelCls}>Description</label>
        <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={`${inputCls} resize-none`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Amenities (comma separated)</label>
          <input type="text" value={form.amenities} onChange={e => setForm({ ...form, amenities: e.target.value })} className={inputCls} placeholder="Pool, spa, wifi, restaurant" />
        </div>
        <div>
          <label className={labelCls}>Tags (comma separated)</label>
          <input type="text" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} className={inputCls} placeholder="safari, luxury" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Contact Email</label>
          <input type="email" value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Contact Phone</label>
          <input type="text" value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Internal Notes</label>
        <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={`${inputCls} resize-none`} />
      </div>
    </div>
  );
}

// Strip empty date strings back to null, coerce numerics, etc. so the DB
// gets well-typed values instead of "" for Date fields (which Mongoose
// casts to Invalid Date).
function normalizeList(list) {
  const toDate = (v) => v ? new Date(v).toISOString() : null;
  return {
    ...list,
    validFrom: toDate(list.validFrom),
    validTo: toDate(list.validTo),
    priority: Number(list.priority) || 0,
    depositPct: Number(list.depositPct) || 0,
    seasons: (list.seasons || []).map(s => ({
      ...s,
      minNights: Number(s.minNights) || 1,
      daysOfWeek: Array.isArray(s.daysOfWeek) ? s.daysOfWeek.map(n => Number(n)).filter(n => n >= 0 && n <= 6) : [],
      specificDates: Array.isArray(s.specificDates) ? s.specificDates.filter(Boolean).map(toDate) : [],
      dateRanges: (s.dateRanges || []).filter(r => r.from && r.to).map(r => ({ from: toDate(r.from), to: toDate(r.to) })),
      rooms: (s.rooms || []).map(r => ({
        ...r,
        pricingMode: r.pricingMode === 'per_room_total' ? 'per_room_total' : 'per_person',
        maxOccupancy: Number(r.maxOccupancy) || 2,
        singleOccupancy: Number(r.singleOccupancy) || 0,
        perPersonSharing: Number(r.perPersonSharing) || 0,
        triplePerPerson: Number(r.triplePerPerson) || 0,
        quadPerPerson: Number(r.quadPerPerson) || 0,
        singleSupplement: Number(r.singleSupplement) || 0,
        childBrackets: (r.childBrackets || []).map(b => ({
          ...b,
          minAge: Number(b.minAge) || 0,
          maxAge: Number(b.maxAge) || 17,
          value: Number(b.value) || 0,
        })),
      })),
      supplements: (s.supplements || []).map(sup => ({
        ...sup,
        amountPerPerson: Number(sup.amountPerPerson) || 0,
        amountPerChild: Number(sup.amountPerChild) || 0,
        amountPerRoom: Number(sup.amountPerRoom) || 0,
        dates: (sup.dates || []).filter(d => d.from && d.to).map(d => ({ from: toDate(d.from), to: toDate(d.to) })),
      })),
    })),
    addOns: (list.addOns || []).map(a => ({ ...a, amount: Number(a.amount) || 0 })),
    passThroughFees: (list.passThroughFees || []).map(f => ({
      ...f,
      flatAmount: Number(f.flatAmount) || 0,
      tieredRows: (f.tieredRows || []).map(r => ({
        ...r,
        adultCitizen: Number(r.adultCitizen) || 0,
        adultResident: Number(r.adultResident) || 0,
        adultNonResident: Number(r.adultNonResident) || 0,
        childCitizen: Number(r.childCitizen) || 0,
        childResident: Number(r.childResident) || 0,
        childNonResident: Number(r.childNonResident) || 0,
        childMinAge: Number(r.childMinAge) || 0,
        childMaxAge: Number(r.childMaxAge) || 17,
        validFrom: toDate(r.validFrom),
        validTo: toDate(r.validTo),
      })),
    })),
    cancellationTiers: (list.cancellationTiers || []).map(t => ({
      ...t,
      daysBefore: Number(t.daysBefore) || 0,
      penaltyPct: Number(t.penaltyPct) || 0,
    })),
    inclusions: Array.isArray(list.inclusions) ? list.inclusions.filter(Boolean) : [],
    exclusions: Array.isArray(list.exclusions) ? list.exclusions.filter(Boolean) : [],
  };
}
