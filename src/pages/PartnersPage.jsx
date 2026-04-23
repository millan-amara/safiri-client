// import { useState, useEffect, useRef } from 'react';
// import api from '../utils/api';
// import { formatCurrency, mealPlanLabels, seasonLabels, seasonColors } from '../utils/helpers';
// import toast from 'react-hot-toast';
// import HotelModal from '../components/partners/HotelModal';
// import TransportModal from '../components/partners/TransportModal';
// import ActivityModal from '../components/partners/ActivityModal';
// import {
//   Hotel, Truck, Ticket, Upload, Plus, Search, Edit2, Trash2,
//   X, ChevronDown, Star, MapPin, DollarSign, Filter,
// } from 'lucide-react';

// const TABS = [
//   { id: 'hotels', label: 'Hotels', icon: Hotel },
//   { id: 'transport', label: 'Transport', icon: Truck },
//   { id: 'activities', label: 'Activities', icon: Ticket },
// ];

// export default function PartnersPage() {
//   const [tab, setTab] = useState('hotels');
//   const [data, setData] = useState({ hotels: [], transport: [], activities: [] });
//   const [stats, setStats] = useState({});
//   const [search, setSearch] = useState('');
//   const [loading, setLoading] = useState(true);
//   const [importing, setImporting] = useState(false);
//   const [showAddModal, setShowAddModal] = useState(false);
//   const [editItem, setEditItem] = useState(null);
//   const fileRef = useRef();

//   const fetchData = async () => {
//     setLoading(true);
//     try {
//       const [hotels, transport, activities, statsRes] = await Promise.all([
//         api.get('/partners/hotels'),
//         api.get('/partners/transport'),
//         api.get('/partners/activities'),
//         api.get('/partners/stats'),
//       ]);
//       setData({
//         hotels: hotels.data.hotels,
//         transport: transport.data.transport,
//         activities: activities.data.activities,
//       });
//       setStats(statsRes.data);
//     } catch (err) {
//       toast.error('Failed to load data');
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => { fetchData(); }, []);

//   const handleImport = async (e) => {
//     const file = e.target.files[0];
//     if (!file) return;
//     setImporting(true);
//     const formData = new FormData();
//     formData.append('file', file);
//     try {
//       const { data: result } = await api.post('/partners/import', formData, {
//         headers: { 'Content-Type': 'multipart/form-data' },
//       });
//       toast.success(result.message);
//       if (result.errors?.length) {
//         result.errors.slice(0, 3).forEach(e => toast.error(e));
//       }
//       fetchData();
//     } catch (err) {
//       toast.error('Import failed');
//     } finally {
//       setImporting(false);
//       if (fileRef.current) fileRef.current.value = '';
//     }
//   };

//   const handleDelete = async (type, id) => {
//     if (!confirm('Are you sure?')) return;
//     try {
//       await api.delete(`/partners/${type}/${id}`);
//       toast.success('Deleted');
//       fetchData();
//     } catch {
//       toast.error('Delete failed');
//     }
//   };

//   // Filter by search
//   const filtered = {
//     hotels: data.hotels.filter(h =>
//       !search || h.name.toLowerCase().includes(search.toLowerCase()) ||
//       h.destination.toLowerCase().includes(search.toLowerCase())
//     ),
//     transport: data.transport.filter(t =>
//       !search || t.name.toLowerCase().includes(search.toLowerCase())
//     ),
//     activities: data.activities.filter(a =>
//       !search || a.name.toLowerCase().includes(search.toLowerCase()) ||
//       a.destination.toLowerCase().includes(search.toLowerCase())
//     ),
//   };

//   // Group hotels by destination
//   const hotelsByDestination = {};
//   filtered.hotels.forEach(h => {
//     if (!hotelsByDestination[h.destination]) hotelsByDestination[h.destination] = [];
//     hotelsByDestination[h.destination].push(h);
//   });

//   return (
//     <div className="space-y-6 animate-fade-in">
//       {/* Header */}
//       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
//         <div>
//           <h1 className="text-2xl font-bold text-slate-brand" style={{ fontFamily: 'Playfair Display, serif' }}>
//             Partner Database
//           </h1>
//           <p className="text-sm text-sand-500 mt-0.5">
//             {stats.hotels || 0} hotels · {stats.transport || 0} transport · {stats.activities || 0} activities across {stats.destinations || 0} destinations
//           </p>
//         </div>
//         <div className="flex items-center gap-2">
//           <input
//             type="file"
//             ref={fileRef}
//             onChange={handleImport}
//             accept=".xlsx,.xls,.csv"
//             className="hidden"
//           />
//           <button
//             onClick={() => fileRef.current?.click()}
//             disabled={importing}
//             className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-sand-200 text-slate-brand text-sm font-medium hover:border-sand-300 transition-colors disabled:opacity-50"
//           >
//             <Upload className="w-4 h-4" />
//             {importing ? 'Importing...' : 'Import Spreadsheet'}
//           </button>
//           <button
//             onClick={() => { setEditItem(null); setShowAddModal(true); }}
//             className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-brand text-white text-sm font-medium hover:bg-amber-700 transition-colors"
//           >
//             <Plus className="w-4 h-4" /> Add {tab === 'hotels' ? 'Hotel' : tab === 'transport' ? 'Transport' : 'Activity'}
//           </button>
//         </div>
//       </div>

//       {/* Tabs + Search */}
//       <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
//         <div className="flex bg-white rounded-lg border border-sand-200 p-1">
//           {TABS.map(({ id, label, icon: Icon }) => (
//             <button
//               key={id}
//               onClick={() => setTab(id)}
//               className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
//                 tab === id ? 'bg-amber-brand text-white' : 'text-sand-500 hover:text-slate-brand'
//               }`}
//             >
//               <Icon className="w-4 h-4" />
//               {label}
//               <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${
//                 tab === id ? 'bg-white/20 text-white' : 'bg-sand-100 text-sand-500'
//               }`}>
//                 {filtered[id].length}
//               </span>
//             </button>
//           ))}
//         </div>

//         <div className="relative w-full sm:w-64">
//           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sand-400" />
//           <input
//             type="text"
//             value={search}
//             onChange={(e) => setSearch(e.target.value)}
//             placeholder="Search..."
//             className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-sand-200 text-sm text-slate-brand placeholder:text-sand-400 focus:outline-none focus:border-amber-brand transition-colors"
//           />
//         </div>
//       </div>

//       {loading ? (
//         <div className="flex items-center justify-center h-40">
//           <div className="w-6 h-6 border-2 border-amber-brand border-t-transparent rounded-full animate-spin" />
//         </div>
//       ) : (
//         <>
//           {/* HOTELS TAB */}
//           {tab === 'hotels' && (
//             <div className="space-y-6">
//               {Object.keys(hotelsByDestination).length === 0 ? (
//                 <EmptyState
//                   icon={Hotel}
//                   title="No hotels yet"
//                   description="Import a spreadsheet or add hotels manually"
//                 />
//               ) : (
//                 Object.entries(hotelsByDestination).sort().map(([dest, hotels]) => (
//                   <div key={dest}>
//                     <div className="flex items-center gap-2 mb-3">
//                       <MapPin className="w-4 h-4 text-amber-brand" />
//                       <h3 className="text-sm font-semibold text-slate-brand">{dest}</h3>
//                       <span className="text-xs text-sand-400">{hotels.length} hotels</span>
//                     </div>
//                     <div className="grid gap-3">
//                       {hotels.map((hotel) => (
//                         <HotelCard key={hotel._id} hotel={hotel} onDelete={handleDelete} onEdit={(h) => { setEditItem(h); setShowAddModal(true); }} />
//                       ))}
//                     </div>
//                   </div>
//                 ))
//               )}
//             </div>
//           )}

//           {/* TRANSPORT TAB */}
//           {tab === 'transport' && (
//             <div className="grid gap-3">
//               {filtered.transport.length === 0 ? (
//                 <EmptyState icon={Truck} title="No transport" description="Import or add transport options" />
//               ) : filtered.transport.map((t) => (
//                 <div key={t._id} className="bg-white rounded-xl border border-sand-200 p-4 flex items-center justify-between group hover:border-sand-300 transition-colors">
//                   <div className="flex items-center gap-4">
//                     <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
//                       <Truck className="w-5 h-5" />
//                     </div>
//                     <div>
//                       <p className="text-sm font-semibold text-slate-brand">{t.name}</p>
//                       <p className="text-xs text-sand-500">
//                         {t.type.toUpperCase()} · {t.capacity} pax · {t.pricingModel.replace('_', '/')} · {t.routeOrZone || 'All zones'}
//                       </p>
//                     </div>
//                   </div>
//                   <div className="flex items-center gap-4">
//                     <div className="text-right">
//                       <p className="text-sm font-bold text-slate-brand">{formatCurrency(t.rate, t.currency)}</p>
//                       <p className={`text-xs px-1.5 py-0.5 rounded ${seasonColors[t.season]}`}>{seasonLabels[t.season]}</p>
//                     </div>
//                     <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
//                       <button onClick={() => { setEditItem(t); setShowAddModal(true); }} className="p-1.5 rounded-md hover:bg-sand-100 text-sand-400 hover:text-slate-brand transition-colors">
//                         <Edit2 className="w-3.5 h-3.5" />
//                       </button>
//                       <button onClick={() => handleDelete('transport', t._id)} className="p-1.5 rounded-md hover:bg-red-50 text-sand-400 hover:text-red-500 transition-colors">
//                         <Trash2 className="w-3.5 h-3.5" />
//                       </button>
//                     </div>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           )}

//           {/* ACTIVITIES TAB */}
//           {tab === 'activities' && (
//             <div className="grid gap-3">
//               {filtered.activities.length === 0 ? (
//                 <EmptyState icon={Ticket} title="No activities" description="Import or add activities" />
//               ) : filtered.activities.map((a) => (
//                 <div key={a._id} className="bg-white rounded-xl border border-sand-200 p-4 flex items-center justify-between group hover:border-sand-300 transition-colors">
//                   <div className="flex items-center gap-4">
//                     <div className="w-10 h-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
//                       <Ticket className="w-5 h-5" />
//                     </div>
//                     <div>
//                       <p className="text-sm font-semibold text-slate-brand">{a.name}</p>
//                       <p className="text-xs text-sand-500">
//                         {a.destination} · {a.duration}h · {a.pricingModel.replace('_', '/')}
//                         {a.commissionRate > 0 && ` · ${a.commissionRate}% comm.`}
//                       </p>
//                     </div>
//                   </div>
//                   <div className="flex items-center gap-4">
//                     <div className="text-right">
//                       <p className="text-sm font-bold text-slate-brand">
//                         {a.costPerPerson > 0 && `${formatCurrency(a.costPerPerson, a.currency)}/pp`}
//                         {a.groupRate > 0 && ` · ${formatCurrency(a.groupRate, a.currency)}/grp`}
//                       </p>
//                       <p className={`text-xs px-1.5 py-0.5 rounded ${seasonColors[a.season]}`}>{seasonLabels[a.season]}</p>
//                     </div>
//                     <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
//                       <button onClick={() => { setEditItem(a); setShowAddModal(true); }} className="p-1.5 rounded-md hover:bg-sand-100 text-sand-400 hover:text-slate-brand transition-colors">
//                         <Edit2 className="w-3.5 h-3.5" />
//                       </button>
//                       <button onClick={() => handleDelete('activities', a._id)} className="p-1.5 rounded-md hover:bg-red-50 text-sand-400 hover:text-red-500 transition-colors">
//                         <Trash2 className="w-3.5 h-3.5" />
//                       </button>
//                     </div>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           )}
//         </>
//       )}

//       {/* ─── MODALS ─────────────────────────────── */}
//       {showAddModal && tab === 'hotels' && (
//         <HotelModal hotel={editItem} onClose={() => { setShowAddModal(false); setEditItem(null); }} onSaved={fetchData} />
//       )}
//       {showAddModal && tab === 'transport' && (
//         <TransportModal item={editItem} onClose={() => { setShowAddModal(false); setEditItem(null); }} onSaved={fetchData} />
//       )}
//       {showAddModal && tab === 'activities' && (
//         <ActivityModal item={editItem} onClose={() => { setShowAddModal(false); setEditItem(null); }} onSaved={fetchData} />
//       )}
//     </div>
//   );
// }

// function HotelCard({ hotel, onDelete, onEdit }) {
//   const [expanded, setExpanded] = useState(false);

//   return (
//     <div className="bg-white rounded-xl border border-sand-200 hover:border-sand-300 transition-colors overflow-hidden group">
//       <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
//         <div className="flex items-center gap-4">
//           <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-brand flex items-center justify-center">
//             <Hotel className="w-5 h-5" />
//           </div>
//           <div>
//             <div className="flex items-center gap-2">
//               <p className="text-sm font-semibold text-slate-brand">{hotel.name}</p>
//               {hotel.stars > 0 && (
//                 <div className="flex items-center gap-0.5">
//                   {Array.from({ length: hotel.stars }).map((_, i) => (
//                     <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
//                   ))}
//                 </div>
//               )}
//             </div>
//             <p className="text-xs text-sand-500">
//               {hotel.location && `${hotel.location} · `}{hotel.rates?.length || 0} rate{hotel.rates?.length !== 1 ? 's' : ''} · {hotel.currency}
//             </p>
//           </div>
//         </div>
//         <div className="flex items-center gap-2">
//           <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
//             <button onClick={(e) => { e.stopPropagation(); onEdit(hotel); }} className="p-1.5 rounded-md hover:bg-sand-100 text-sand-400 hover:text-slate-brand transition-colors">
//               <Edit2 className="w-3.5 h-3.5" />
//             </button>
//             <button onClick={(e) => { e.stopPropagation(); onDelete('hotels', hotel._id); }} className="p-1.5 rounded-md hover:bg-red-50 text-sand-400 hover:text-red-500 transition-colors">
//               <Trash2 className="w-3.5 h-3.5" />
//             </button>
//           </div>
//           <ChevronDown className={`w-4 h-4 text-sand-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
//         </div>
//       </div>

//       {expanded && hotel.rates?.length > 0 && (
//         <div className="border-t border-sand-100 px-4 py-3">
//           <table className="w-full text-xs">
//             <thead>
//               <tr className="text-sand-500">
//                 <th className="text-left py-1 font-medium">Room Type</th>
//                 <th className="text-left py-1 font-medium">Season</th>
//                 <th className="text-left py-1 font-medium">Months</th>
//                 <th className="text-right py-1 font-medium">Rate/Night</th>
//                 <th className="text-left py-1 font-medium">Meal Plan</th>
//                 <th className="text-center py-1 font-medium">Max Occ.</th>
//               </tr>
//             </thead>
//             <tbody>
//               {hotel.rates.map((r, i) => (
//                 <tr key={i} className="border-t border-sand-50">
//                   <td className="py-1.5 font-medium text-slate-brand">{r.roomType}</td>
//                   <td className="py-1.5">
//                     <span className={`px-1.5 py-0.5 rounded ${seasonColors[r.season]}`}>
//                       {seasonLabels[r.season]}
//                     </span>
//                   </td>
//                   <td className="py-1.5 text-sand-600">{r.startMonth}–{r.endMonth}</td>
//                   <td className="py-1.5 text-right font-semibold text-slate-brand">{formatCurrency(r.ratePerNight, hotel.currency)}</td>
//                   <td className="py-1.5 text-sand-600">{mealPlanLabels[r.mealPlan] || r.mealPlan}</td>
//                   <td className="py-1.5 text-center text-sand-600">{r.maxOccupancy}</td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//       )}
//     </div>
//   );
// }

// function EmptyState({ icon: Icon, title, description }) {
//   return (
//     <div className="bg-white rounded-xl border border-sand-200 p-12 text-center">
//       <div className="w-12 h-12 rounded-xl bg-sand-100 text-sand-400 flex items-center justify-center mx-auto mb-3">
//         <Icon className="w-6 h-6" />
//       </div>
//       <p className="text-sm font-semibold text-slate-brand">{title}</p>
//       <p className="text-xs text-sand-500 mt-1">{description}</p>
//     </div>
//   );
// }




import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { formatCurrency, mealPlanLabels, seasonLabels, seasonColors } from '../utils/helpers';
import toast from 'react-hot-toast';
import HotelModal from '../components/partners/HotelModal';
import TransportModal from '../components/partners/TransportModal';
import ActivityModal from '../components/partners/ActivityModal';
import PackageModal from '../components/partners/PackageModal';
import ConfirmDialog from '../components/shared/ConfirmDialog';

const DELETE_LABELS = {
  hotels: 'hotel',
  transport: 'transport provider',
  activities: 'activity',
  packages: 'package',
};
import {
  Hotel, Truck, Ticket, Upload, Plus, Search, Edit2, Trash2,
  X, ChevronDown, Star, MapPin, DollarSign, Filter, Lock, Map, Download,
} from 'lucide-react';

const TABS = [
  { id: 'hotels', label: 'Hotels', icon: Hotel },
  { id: 'transport', label: 'Transport', icon: Truck },
  { id: 'activities', label: 'Activities', icon: Ticket },
  { id: 'packages', label: 'Packages', icon: Map },
];

export default function PartnersPage() {
  const [tab, setTab] = useState('hotels');
  const [data, setData] = useState({ hotels: [], transport: [], activities: [], packages: [] });
  const [stats, setStats] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const fileRef = useRef();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [hotels, transport, activities, packages, statsRes] = await Promise.all([
        api.get('/partners/hotels'),
        api.get('/partners/transport'),
        api.get('/partners/activities'),
        api.get('/partners/packages'),
        api.get('/partners/stats'),
      ]);
      setData({
        hotels: hotels.data.hotels,
        transport: transport.data.transport,
        activities: activities.data.activities,
        packages: packages.data.packages,
      });
      setStats(statsRes.data);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const { data: result } = await api.post('/partners/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(result.message);
      if (result.errors?.length) {
        result.errors.slice(0, 3).forEach(e => toast.error(e));
      }
      fetchData();
    } catch (err) {
      toast.error('Import failed');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = (type, id, name) => {
    setDeleteTarget({ type, id, name });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/partners/${deleteTarget.type}/${deleteTarget.id}`);
      toast.success('Deleted');
      setDeleteTarget(null);
      fetchData();
    } catch {
      toast.error('Delete failed');
    }
  };

  // Filter by search
  const filtered = {
    hotels: data.hotels.filter(h =>
      !search || h.name.toLowerCase().includes(search.toLowerCase()) ||
      h.destination.toLowerCase().includes(search.toLowerCase())
    ),
    transport: data.transport.filter(t =>
      !search || t.name.toLowerCase().includes(search.toLowerCase())
    ),
    activities: data.activities.filter(a =>
      !search || a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.destination.toLowerCase().includes(search.toLowerCase())
    ),
    packages: (data.packages || []).filter(p =>
      !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.destination || '').toLowerCase().includes(search.toLowerCase())
    ),
  };

  // Group hotels by destination
  const hotelsByDestination = {};
  filtered.hotels.forEach(h => {
    if (!hotelsByDestination[h.destination]) hotelsByDestination[h.destination] = [];
    hotelsByDestination[h.destination].push(h);
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground" style={{ fontFamily: 'Playfair Display, serif' }}>
            Partner Database
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {stats.hotels || 0} hotels · {stats.transport || 0} transport · {stats.activities || 0} activities across {stats.destinations || 0} destinations
          </p>
          <p className="text-[11px] text-muted-foreground/70 mt-1 inline-flex items-center gap-1" title="Your suppliers and rates are scoped to your organization. No other SafiriPro user can see this data.">
            <Lock className="w-3 h-3" /> Private to your organization — only your team can see these
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="file"
            ref={fileRef}
            onChange={handleImport}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />
          <button
            onClick={async () => {
              try {
                const res = await api.get('/partners/import/template', { responseType: 'blob' });
                const url = window.URL.createObjectURL(new Blob([res.data]));
                const link = document.createElement('a');
                link.href = url;
                link.download = 'safiripro-import-template.xlsx';
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
              } catch (err) {
                toast.error('Could not download template');
              }
            }}
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg bg-card border border-border text-foreground text-xs sm:text-sm font-medium hover:border-border transition-colors"
            title="Download a blank template with example rows"
          >
            <Download className="w-4 h-4" />
            <span className="hidden xs:inline">Template</span>
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg bg-card border border-border text-foreground text-xs sm:text-sm font-medium hover:border-border transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden xs:inline">{importing ? 'Importing...' : 'Import Spreadsheet'}</span>
            <span className="xs:hidden">{importing ? '...' : 'Import'}</span>
          </button>
          <button
            onClick={() => { setEditItem(null); setShowAddModal(true); }}
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg bg-primary text-white text-xs sm:text-sm font-medium hover:bg-primary transition-colors"
          >
            <Plus className="w-4 h-4" /> Add {tab === 'hotels' ? 'Hotel' : tab === 'transport' ? 'Transport' : tab === 'activities' ? 'Activity' : 'Package'}
          </button>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between">
        <div className="flex bg-card rounded-lg border border-border p-1 w-full sm:w-fit overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                tab === id ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${
                tab === id ? 'bg-card/20 text-white' : 'bg-muted text-muted-foreground'
              }`}>
                {filtered[id].length}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* HOTELS TAB */}
          {tab === 'hotels' && (
            <div className="space-y-6">
              {Object.keys(hotelsByDestination).length === 0 ? (
                <EmptyState
                  icon={Hotel}
                  title="No hotels yet"
                  description="Import a spreadsheet or add hotels manually"
                />
              ) : (
                Object.entries(hotelsByDestination).sort().map(([dest, hotels]) => (
                  <div key={dest}>
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-semibold text-foreground">{dest}</h3>
                      <span className="text-xs text-muted-foreground/70">{hotels.length} hotels</span>
                    </div>
                    <div className="grid gap-3">
                      {hotels.map((hotel) => (
                        <HotelCard key={hotel._id} hotel={hotel} onDelete={handleDelete} onEdit={(h) => { setEditItem(h); setShowAddModal(true); }} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TRANSPORT TAB */}
          {tab === 'transport' && (
            <div className="grid gap-3">
              {filtered.transport.length === 0 ? (
                <EmptyState icon={Truck} title="No transport" description="Import or add transport options" />
              ) : filtered.transport.map((t) => (
                <div key={t._id} className="bg-card rounded-xl border border-border p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 group hover:border-border transition-colors">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 sm:truncate">
                        {t.type.toUpperCase()} · {t.capacity} pax · {t.pricingModel.replace('_', '/')} · {t.routeOrZone || 'All zones'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0">
                    <div className="sm:text-right">
                      <p className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(t.rate, t.currency)}</p>
                      <p className={`text-xs px-1.5 py-0.5 rounded inline-block ${seasonColors[t.season]}`}>{seasonLabels[t.season]}</p>
                    </div>
                    <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditItem(t); setShowAddModal(true); }} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground/70 hover:text-foreground transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete('transport', t._id, t.name)} className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground/70 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ACTIVITIES TAB */}
          {tab === 'activities' && (
            <div className="grid gap-3">
              {filtered.activities.length === 0 ? (
                <EmptyState icon={Ticket} title="No activities" description="Import or add activities" />
              ) : filtered.activities.map((a) => (
                <div key={a._id} className="bg-card rounded-xl border border-border p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 group hover:border-border transition-colors">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                      <Ticket className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 sm:truncate">
                        {a.destination} · {a.duration}h · {a.pricingModel.replace('_', '/')}
                        {a.commissionRate > 0 && ` · ${a.commissionRate}% comm.`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0">
                    <div className="sm:text-right">
                      <p className="text-sm font-bold text-foreground tabular-nums">
                        {a.costPerPerson > 0 && `${formatCurrency(a.costPerPerson, a.currency)}/pp`}
                        {a.groupRate > 0 && ` · ${formatCurrency(a.groupRate, a.currency)}/grp`}
                      </p>
                      <p className={`text-xs px-1.5 py-0.5 rounded inline-block ${seasonColors[a.season]}`}>{seasonLabels[a.season]}</p>
                    </div>
                    <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditItem(a); setShowAddModal(true); }} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground/70 hover:text-foreground transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete('activities', a._id, a.name)} className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground/70 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* PACKAGES TAB */}
          {tab === 'packages' && (
            <div className="grid gap-3">
              {filtered.packages.length === 0 ? (
                <EmptyState icon={Map} title="No packages" description="Add multi-day trails/packaged trips with pax-tiered pricing" />
              ) : filtered.packages.map((p) => {
                const startTier = p.pricing?.paxTiers?.[0];
                return (
                  <div key={p._id} className="bg-card rounded-xl border border-border p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 group hover:border-border transition-colors">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                        <Map className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 sm:truncate">
                          {p.destination || '—'}
                          {p.durationNights > 0 && ` · ${p.durationNights} night${p.durationNights === 1 ? '' : 's'}`}
                          {p.segments?.length > 0 && ` · ${p.segments.length} camp${p.segments.length === 1 ? '' : 's'}`}
                          {p.pricing?.audience?.length > 0 && ` · ${p.pricing.audience.join('/')}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0">
                      <div className="sm:text-right">
                        {startTier && (
                          <p className="text-sm font-bold text-foreground tabular-nums">
                            from {formatCurrency(startTier.pricePerPerson, p.pricing?.currency)}/pp
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground/70">{p.pricing?.paxTiers?.length || 0} tier{p.pricing?.paxTiers?.length === 1 ? '' : 's'}</p>
                      </div>
                      <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditItem(p); setShowAddModal(true); }} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground/70 hover:text-foreground transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete('packages', p._id, p.name)} className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground/70 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ─── MODALS ─────────────────────────────── */}
      {showAddModal && tab === 'hotels' && (
        <HotelModal hotel={editItem} onClose={() => { setShowAddModal(false); setEditItem(null); }} onSaved={fetchData} />
      )}
      {showAddModal && tab === 'transport' && (
        <TransportModal item={editItem} onClose={() => { setShowAddModal(false); setEditItem(null); }} onSaved={fetchData} />
      )}
      {showAddModal && tab === 'activities' && (
        <ActivityModal item={editItem} onClose={() => { setShowAddModal(false); setEditItem(null); }} onSaved={fetchData} />
      )}
      {showAddModal && tab === 'packages' && (
        <PackageModal item={editItem} onClose={() => { setShowAddModal(false); setEditItem(null); }} onSaved={fetchData} />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`Delete this ${DELETE_LABELS[deleteTarget.type] || 'item'}?`}
          message={
            deleteTarget.name
              ? `"${deleteTarget.name}" will be permanently removed. This cannot be undone.`
              : 'This will be permanently removed. This cannot be undone.'
          }
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function HotelCard({ hotel, onDelete, onEdit }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-card rounded-xl border border-border hover:border-border transition-colors overflow-hidden group">
      <div className="p-3 sm:p-4 flex items-center justify-between gap-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Hotel className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground truncate">{hotel.name}</p>
              {hotel.stars > 0 && (
                <div className="flex items-center gap-0.5 shrink-0">
                  {Array.from({ length: hotel.stars }).map((_, i) => (
                    <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {hotel.location && `${hotel.location} · `}{hotel.rateLists?.length || 0} rate list{hotel.rateLists?.length !== 1 ? 's' : ''} · {hotel.currency}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <button onClick={(e) => { e.stopPropagation(); onEdit(hotel); }} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground/70 hover:text-foreground transition-colors">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete('hotels', hotel._id, hotel.name); }} className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground/70 hover:text-red-500 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <ChevronDown className={`w-4 h-4 text-muted-foreground/70 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {expanded && hotel.rateLists?.length > 0 && (
        <div className="border-t border-border px-3 sm:px-4 py-3 space-y-2.5">
          {hotel.rateLists.filter(l => l.isActive !== false).map((list, i) => (
            <RateListSummary key={list._id || i} list={list} />
          ))}
        </div>
      )}
    </div>
  );
}

// Compact summary of one rate list — header (name/audience/currency/meal plan/validity)
// + per-season cheapest pricing.
function RateListSummary({ list }) {
  const validity = list.validFrom || list.validTo
    ? `${list.validFrom ? new Date(list.validFrom).toLocaleDateString() : '…'} → ${list.validTo ? new Date(list.validTo).toLocaleDateString() : '…'}`
    : 'No validity set';

  return (
    <div className="rounded-lg border border-border/60 bg-background">
      <div className="px-3 py-2 flex items-center gap-2 flex-wrap border-b border-border/40">
        <span className="text-sm font-semibold text-foreground">{list.name}</span>
        {(list.audience || []).map(a => (
          <span key={a} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary uppercase">{a}</span>
        ))}
        <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">{list.currency}</span>
        <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">{list.mealPlan}</span>
        {list.priority > 0 && <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700">P{list.priority}</span>}
        <span className="text-[10px] text-muted-foreground ml-auto">{validity}</span>
      </div>
      {(list.seasons || []).length > 0 && (
        <div className="px-3 py-2 overflow-x-auto">
          <table className="w-full text-xs min-w-[560px]">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left py-1 font-medium">Season</th>
                <th className="text-left py-1 font-medium">Room</th>
                <th className="text-right py-1 font-medium">Single</th>
                <th className="text-right py-1 font-medium">PP Sharing</th>
                <th className="text-right py-1 font-medium">Triple PP</th>
                <th className="text-right py-1 font-medium">Quad PP</th>
              </tr>
            </thead>
            <tbody>
              {list.seasons.map((s, si) => (
                (s.rooms || []).map((r, ri) => (
                  <tr key={`${si}-${ri}`} className="border-t border-border/50">
                    <td className="py-1 text-foreground">{ri === 0 ? s.label : ''}</td>
                    <td className="py-1 text-muted-foreground">{r.roomType}</td>
                    <td className="py-1 text-right">{formatCurrency(r.singleOccupancy, list.currency)}</td>
                    <td className="py-1 text-right font-semibold">{formatCurrency(r.perPersonSharing, list.currency)}</td>
                    <td className="py-1 text-right">{formatCurrency(r.triplePerPerson, list.currency)}</td>
                    <td className="py-1 text-right">{formatCurrency(r.quadPerPerson, list.currency)}</td>
                  </tr>
                ))
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(list.passThroughFees?.length > 0 || list.addOns?.length > 0 || list.cancellationTiers?.length > 0) && (
        <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t border-border/40 flex gap-3">
          {list.passThroughFees?.length > 0 && <span>{list.passThroughFees.length} pass-through fee{list.passThroughFees.length === 1 ? '' : 's'}</span>}
          {list.addOns?.length > 0 && <span>{list.addOns.length} add-on{list.addOns.length === 1 ? '' : 's'}</span>}
          {list.cancellationTiers?.length > 0 && <span>{list.cancellationTiers.length} cancellation tier{list.cancellationTiers.length === 1 ? '' : 's'}</span>}
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="bg-card rounded-xl border border-border p-12 text-center">
      <div className="w-12 h-12 rounded-xl bg-muted text-muted-foreground/70 flex items-center justify-center mx-auto mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
  );
}
