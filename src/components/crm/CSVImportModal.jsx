import { useState, useRef } from 'react';
import Modal from '../shared/Modal';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Upload, Sparkles, ArrowRight, Check } from 'lucide-react';

const TARGET_FIELDS = [
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'company', label: 'Company' },
  { key: 'position', label: 'Position' },
  { key: 'country', label: 'Country' },
  { key: 'notes', label: 'Notes' },
  { key: null, label: '— Skip —' },
];

export default function CSVImportModal({ onClose, onImported }) {
  const [step, setStep] = useState('upload'); // upload | map | importing | done
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [sampleRows, setSampleRows] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [mappings, setMappings] = useState({});
  const [aiLoading, setAiLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef();

  const handleFileSelect = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);

    const formData = new FormData();
    formData.append('file', f);

    try {
      const { data } = await api.post('/uploads/contacts-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setHeaders(data.headers);
      setSampleRows(data.sampleRows);
      setTotalRows(data.totalRows);

      // Default empty mappings
      const defaultMappings = {};
      data.headers.forEach(h => { defaultMappings[h] = null; });
      setMappings(defaultMappings);

      setStep('map');
    } catch (err) {
      toast.error('Failed to parse CSV');
    }
  };

  const autoMapWithAI = async () => {
    setAiLoading(true);
    try {
      const { data } = await api.post('/ai/map-columns', {
        sourceColumns: headers,
        sampleRows,
      });
      if (data.mappings) {
        setMappings(data.mappings);
        toast.success(`AI mapped columns (${data.confidence} confidence)`);
      }
    } catch (err) {
      toast.error('AI mapping failed — map manually');
    } finally {
      setAiLoading(false);
    }
  };

  const handleImport = async () => {
    // Check at least firstName or email is mapped
    const mapped = Object.values(mappings).filter(Boolean);
    if (!mapped.includes('firstName') && !mapped.includes('email')) {
      toast.error('Map at least First Name or Email');
      return;
    }

    setImporting(true);
    setStep('importing');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('mappings', JSON.stringify(mappings));

    try {
      const { data } = await api.post('/uploads/contacts-csv/apply', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data);
      setStep('done');
      if (data.imported > 0) onImported?.();
    } catch (err) {
      toast.error('Import failed');
      setStep('map');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal title="Import Contacts from CSV" onClose={onClose} wide>
      {/* Step: Upload */}
      {step === 'upload' && (
        <div className="text-center py-8">
          <input type="file" ref={fileRef} onChange={handleFileSelect} accept=".csv,.txt" className="hidden" />
          <div className="w-16 h-16 rounded-xl bg-muted text-muted-foreground/70 flex items-center justify-center mx-auto mb-4">
            <Upload className="w-8 h-8" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">Upload a CSV file</h3>
          <p className="text-xs text-muted-foreground mb-4">Your CSV can have any column names — AI will figure out the mapping</p>
          <button onClick={() => fileRef.current?.click()} className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary transition-colors">
            Choose File
          </button>
        </div>
      )}

      {/* Step: Map columns */}
      {step === 'map' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-foreground"><span className="font-semibold">{totalRows}</span> rows found in <span className="font-medium">{file?.name}</span></p>
            <button
              onClick={autoMapWithAI}
              disabled={aiLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 border border-primary/30 text-xs text-primary font-medium hover:from-amber-100 hover:to-orange-100 disabled:opacity-50 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {aiLoading ? 'AI mapping...' : 'Auto-map with AI'}
            </button>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-background">
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">CSV Column</th>
                  <th className="text-center px-3 py-2 font-semibold text-muted-foreground/70 w-8"></th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Maps To</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Sample</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((header) => (
                  <tr key={header} className="border-t border-border">
                    <td className="px-3 py-2 font-medium text-foreground">{header}</td>
                    <td className="px-3 py-2 text-center"><ArrowRight className="w-3 h-3 text-muted-foreground/40 mx-auto" /></td>
                    <td className="px-3 py-2">
                      <select
                        value={mappings[header] || ''}
                        onChange={(e) => setMappings({ ...mappings, [header]: e.target.value || null })}
                        className={`w-full px-2 py-1 rounded border text-xs ${
                          mappings[header] ? 'border-green-300 bg-green-50 text-green-800' : 'border-border bg-card text-muted-foreground'
                        } focus:outline-none focus:border-primary`}
                      >
                        <option value="">— Skip —</option>
                        {TARGET_FIELDS.filter(f => f.key).map(f => (
                          <option key={f.key} value={f.key}>{f.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-[120px]">
                      {sampleRows[0]?.[header] || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted">Cancel</button>
            <button onClick={handleImport} className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary transition-colors">
              Import {totalRows} Contacts
            </button>
          </div>
        </div>
      )}

      {/* Step: Importing */}
      {step === 'importing' && (
        <div className="text-center py-8">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-foreground">Importing contacts...</p>
        </div>
      )}

      {/* Step: Done */}
      {step === 'done' && result && (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Import Complete</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Successfully imported <span className="font-bold text-green-600">{result.imported}</span> of {result.total} contacts
          </p>
          {result.errors?.length > 0 && (
            <div className="text-left bg-red-50 border border-red-200 rounded-lg p-3 mb-4 max-h-24 overflow-y-auto">
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-600">{e}</p>
              ))}
            </div>
          )}
          <button onClick={onClose} className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary transition-colors">
            Done
          </button>
        </div>
      )}
    </Modal>
  );
}
