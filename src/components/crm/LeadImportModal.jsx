import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../shared/Modal';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Upload, AlertTriangle, Check, FileText, UserCheck } from 'lucide-react';

const TRIP_TYPES = [
  { value: '', label: 'Not specified' },
  { value: 'safari', label: 'Safari' },
  { value: 'beach', label: 'Beach Holiday' },
  { value: 'honeymoon', label: 'Honeymoon' },
  { value: 'family', label: 'Family Trip' },
  { value: 'corporate', label: 'Corporate / Group' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'cultural', label: 'Cultural' },
  { value: 'mixed', label: 'Mixed (Safari + Beach)' },
];
const CLIENT_TYPES = [
  { value: 'retail', label: 'Retail (rack / public)' },
  { value: 'contract', label: 'Contract (DMC / agent)' },
  { value: 'resident', label: 'Resident (EA / citizen)' },
];
const NATIONALITIES = [
  { value: 'nonResident', label: 'Non-resident (international)' },
  { value: 'resident', label: 'Resident (EA)' },
  { value: 'citizen', label: 'Citizen' },
];

const inputCls = 'w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-1';

export default function LeadImportModal({ pipelines, onClose, onImported }) {
  const [step, setStep] = useState('upload'); // upload | review | importing | done
  const [fileName, setFileName] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [confidence, setConfidence] = useState({});
  const [duplicates, setDuplicates] = useState([]);
  const [linkContactId, setLinkContactId] = useState(null); // null = create new
  const [contact, setContact] = useState(null);
  const [deal, setDeal] = useState(null);
  const [createdDeal, setCreatedDeal] = useState(null);
  const fileRef = useRef();

  const defaultPipeline = pipelines?.find(p => p.isDefault) || pipelines?.[0];
  const [pipelineId, setPipelineId] = useState(defaultPipeline?._id || '');
  const [stage, setStage] = useState(defaultPipeline?.stages?.[0]?.name || '');
  const selectedPipeline = pipelines?.find(p => p._id === pipelineId);

  // True when the model wasn't confident about a field — drives the amber hint.
  const lowConf = (key) => confidence[key] !== undefined && confidence[key] < 0.5;

  const handleFileSelect = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== 'application/pdf') { toast.error('Please upload a PDF'); return; }
    setFileName(f.name);
    setStep('importing'); // reuse the spinner step while extracting

    const fd = new FormData();
    fd.append('file', f);
    try {
      const { data } = await api.post('/leads/extract-pdf', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setContact(data.contactDraft || {});
      setDeal(data.dealDraft || {});
      setConfidence(data.confidence || {});
      setWarnings(data.warnings || []);
      setDuplicates(data.possibleDuplicates || []);
      setLinkContactId(null);
      setStep('review');
      if (data.warnings?.length) {
        toast(`Extracted with ${data.warnings.length} thing(s) to check`, { icon: '⚠️', duration: 5000 });
      }
    } catch (err) {
      // 402 (PDF pages exhausted) is surfaced by the api interceptor's toast.
      if (err.response?.status !== 402) {
        toast.error(err.response?.data?.message || 'Could not read that PDF');
      }
      setStep('upload');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleImport = async () => {
    if (!linkContactId && !contact?.firstName?.trim()) {
      toast.error('Contact first name is required');
      return;
    }
    setStep('importing');
    try {
      const { data } = await api.post('/leads/import', {
        contactDraft: contact,
        dealDraft: deal,
        existingContactId: linkContactId,
        pipeline: pipelineId,
        stage,
      });
      setCreatedDeal(data.deal);
      setStep('done');
      onImported?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
      setStep('review');
    }
  };

  const setC = (k, v) => setContact(prev => ({ ...prev, [k]: v }));
  const setD = (k, v) => setDeal(prev => ({ ...prev, [k]: v }));

  return (
    <Modal title="Import lead from PDF" onClose={onClose} wide persistent>
      {/* Step: Upload */}
      {step === 'upload' && (
        <div className="text-center py-8">
          <input type="file" ref={fileRef} onChange={handleFileSelect} accept="application/pdf,.pdf" className="hidden" />
          <div className="w-16 h-16 rounded-xl bg-muted text-muted-foreground/70 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">Upload a lead PDF</h3>
          <p className="text-xs text-muted-foreground mb-4">
            We'll read it into a draft contact + deal for you to review. Nothing is saved until you confirm.
          </p>
          <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary transition-colors">
            <Upload className="w-4 h-4" /> Choose PDF
          </button>
        </div>
      )}

      {/* Step: Importing / Extracting spinner */}
      {step === 'importing' && (
        <div className="text-center py-10">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-foreground">Working on {fileName || 'the lead'}…</p>
        </div>
      )}

      {/* Step: Review */}
      {step === 'review' && contact && deal && (
        <div className="space-y-4 max-h-[72vh] overflow-y-auto pr-1">
          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
              <div className="flex items-center gap-1.5 mb-1.5 text-amber-800">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-semibold">Please double-check ({warnings.length})</span>
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                {warnings.map((w, i) => <li key={i} className="text-xs text-amber-800">{w}</li>)}
              </ul>
            </div>
          )}

          {/* Dedup */}
          {duplicates.length > 0 && (
            <div className="rounded-lg border border-blue-300 bg-blue-50 p-3">
              <div className="flex items-center gap-1.5 mb-2 text-blue-800">
                <UserCheck className="w-4 h-4" />
                <span className="text-xs font-semibold">This may already be a contact</span>
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-xs text-blue-900 cursor-pointer">
                  <input type="radio" checked={linkContactId === null} onChange={() => setLinkContactId(null)} />
                  Create a new contact
                </label>
                {duplicates.map(dup => (
                  <label key={dup._id} className="flex items-center gap-2 text-xs text-blue-900 cursor-pointer">
                    <input type="radio" checked={linkContactId === dup._id} onChange={() => setLinkContactId(dup._id)} />
                    Link to <span className="font-medium">{dup.firstName} {dup.lastName}</span>
                    <span className="text-blue-700/70">{dup.email || dup.phone}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Contact (hidden when linking to an existing one) */}
          {linkContactId === null && (
            <div className="border-t border-border pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contact</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>First Name *</label>
                  <input value={contact.firstName || ''} onChange={e => setC('firstName', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Last Name</label>
                  <input value={contact.lastName || ''} onChange={e => setC('lastName', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input value={contact.email || ''} onChange={e => setC('email', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input value={contact.phone || ''} onChange={e => setC('phone', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Country</label>
                  <input value={contact.country || ''} onChange={e => setC('country', e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>
          )}

          {/* Deal */}
          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Deal</p>

            <div className="mb-3">
              <label className={labelCls}>Deal Title</label>
              <input value={deal.title || ''} onChange={e => setD('title', e.target.value)} className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className={labelCls}>Pipeline</label>
                <select value={pipelineId} onChange={e => {
                  const pl = pipelines?.find(p => p._id === e.target.value);
                  setPipelineId(e.target.value);
                  setStage(pl?.stages?.[0]?.name || '');
                }} className={inputCls}>
                  {pipelines?.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Stage</label>
                <select value={stage} onChange={e => setStage(e.target.value)} className={inputCls}>
                  {selectedPipeline?.stages?.slice().sort((a, b) => a.order - b.order).map(s => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className={labelCls}>Trip Type {lowConf('tripType') && <span className="text-amber-600">• check</span>}</label>
                <select value={deal.tripType || ''} onChange={e => setD('tripType', e.target.value)} className={inputCls}>
                  {TRIP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Destination {lowConf('destinationPrimary') && <span className="text-amber-600">• check</span>}</label>
                <input value={deal.destination || ''} onChange={e => setD('destination', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Arrival City</label>
                <input value={deal.arrivalCity || ''} onChange={e => setD('arrivalCity', e.target.value)} className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-3">
              <div>
                <label className={labelCls}>Nights</label>
                <input type="number" min={0} value={deal.tripDuration ?? ''} onChange={e => setD('tripDuration', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Adults</label>
                <input type="number" min={0} value={deal.adults ?? ''} onChange={e => setD('adults', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Children</label>
                <input type="number" min={0} value={deal.children ?? ''} onChange={e => setD('children', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Child ages {deal.children > 0 && (deal.childAges?.length || 0) < deal.children && <span className="text-amber-600">• add</span>}</label>
                <input type="text" value={(deal.childAges || []).join(', ')} onChange={e => setD('childAges', e.target.value.split(',').map(s => parseInt(s.trim(), 10)).filter(Number.isFinite))} className={inputCls} placeholder="5, 9" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className={labelCls}>Start</label>
                <input type="date" value={deal.travelDates?.start || ''} onChange={e => setD('travelDates', { ...deal.travelDates, start: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>End</label>
                <input type="date" value={deal.travelDates?.end || ''} onChange={e => setD('travelDates', { ...deal.travelDates, end: e.target.value })} className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className={labelCls}>Budget {lowConf('budget') && <span className="text-amber-600">• check</span>}</label>
                <input type="number" min={0} value={deal.budget ?? ''} onChange={e => setD('budget', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Currency</label>
                <select value={deal.budgetCurrency || 'USD'} onChange={e => setD('budgetCurrency', e.target.value)} className={inputCls}>
                  <option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option>
                  <option value="KES">KES</option><option value="TZS">TZS</option><option value="UGX">UGX</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Nationality (fee tier) {lowConf('nationality') && <span className="text-amber-600">• check</span>}</label>
                <select value={deal.nationality || 'nonResident'} onChange={e => setD('nationality', e.target.value)} className={inputCls}>
                  {NATIONALITIES.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className={labelCls}>Rate type</label>
                <select value={deal.clientType || 'retail'} onChange={e => setD('clientType', e.target.value)} className={inputCls}>
                  {CLIENT_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Special Requests</label>
              <textarea rows={5} value={deal.specialRequests || ''} onChange={e => setD('specialRequests', e.target.value)} className={`${inputCls} resize-none`} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border sticky bottom-0 bg-card">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted">Cancel</button>
            <button onClick={handleImport} className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary transition-colors">
              {linkContactId ? 'Create deal for contact' : 'Create contact + deal'}
            </button>
          </div>
        </div>
      )}

      {/* Step: Done */}
      {step === 'done' && (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Lead imported</h3>
          <p className="text-sm text-muted-foreground mb-5">{createdDeal?.title}</p>
          <div className="flex items-center justify-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted">Done</button>
            {createdDeal?._id && (
              <Link to={`/crm/deals/${createdDeal._id}`} onClick={onClose} className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary transition-colors">
                Open deal
              </Link>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
