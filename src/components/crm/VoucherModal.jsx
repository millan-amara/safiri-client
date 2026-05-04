import { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { X, Save, Plus, Trash2 } from 'lucide-react';

const MEAL_PLANS = [
  { value: '', label: 'Not specified' },
  { value: 'RO', label: 'Room only' },
  { value: 'BB', label: 'Bed & breakfast' },
  { value: 'HB', label: 'Half board' },
  { value: 'FB', label: 'Full board' },
  { value: 'AI', label: 'All inclusive' },
  { value: 'GAME_PACKAGE', label: 'Game package (incl. drives)' },
];

// Create + edit modal. When `voucher` is supplied we PUT, otherwise POST.
// Hotel picker is a typeahead over the org's Hotel catalog; falling back to
// free-text fields is allowed for ad-hoc lodges not in the catalog.
export default function VoucherModal({ deal, voucher, onClose, onSaved }) {
  const isEdit = !!voucher;

  // Default the date range from the deal's travelDates if creating fresh.
  const defaultIn = voucher?.checkIn
    ? new Date(voucher.checkIn).toISOString().slice(0, 10)
    : (deal?.travelDates?.start ? new Date(deal.travelDates.start).toISOString().slice(0, 10) : '');
  const defaultOut = voucher?.checkOut
    ? new Date(voucher.checkOut).toISOString().slice(0, 10)
    : (deal?.travelDates?.end ? new Date(deal.travelDates.end).toISOString().slice(0, 10) : '');

  const [hotels, setHotels] = useState([]);
  const [hotelId, setHotelId] = useState(voucher?.hotelRef || '');
  const [hotel, setHotel] = useState({
    name: voucher?.hotel?.name || '',
    location: voucher?.hotel?.location || '',
    address: voucher?.hotel?.address || '',
    contactEmail: voucher?.hotel?.contactEmail || '',
    contactPhone: voucher?.hotel?.contactPhone || '',
  });
  const [guest, setGuest] = useState({
    name: voucher?.guest?.name || (deal?.contact ? `${deal.contact.firstName || ''} ${deal.contact.lastName || ''}`.trim() : ''),
    email: voucher?.guest?.email || deal?.contact?.email || '',
    phone: voucher?.guest?.phone || deal?.contact?.phone || '',
  });
  const [adults, setAdults] = useState(voucher?.adults ?? deal?.groupSize ?? 2);
  const [children, setChildren] = useState(voucher?.children ?? 0);
  const [checkIn, setCheckIn] = useState(defaultIn);
  const [checkOut, setCheckOut] = useState(defaultOut);
  const [roomType, setRoomType] = useState(voucher?.roomType || '');
  const [rooms, setRooms] = useState(voucher?.rooms ?? 1);
  const [mealPlan, setMealPlan] = useState(voucher?.mealPlan || '');
  const [confirmationNumber, setConfirmationNumber] = useState(voucher?.confirmationNumber || '');
  const [bookingReference, setBookingReference] = useState(voucher?.bookingReference || '');
  const [inclusions, setInclusions] = useState(voucher?.inclusions?.length ? voucher.inclusions : ['']);
  const [exclusions, setExclusions] = useState(voucher?.exclusions?.length ? voucher.exclusions : ['']);
  const [specialRequests, setSpecialRequests] = useState(voucher?.specialRequests || '');
  const [notes, setNotes] = useState(voucher?.notes || '');
  const [saving, setSaving] = useState(false);

  // Load the hotel catalog once so the operator can pick from existing partners.
  useEffect(() => {
    api.get('/partners/hotels')
      .then(({ data }) => setHotels(data.hotels || []))
      .catch(() => setHotels([]));
  }, []);

  // When the operator picks a hotel from the catalog, snapshot its fields
  // into the form. They can still edit afterwards before saving.
  useEffect(() => {
    if (!hotelId) return;
    const h = hotels.find(x => x._id === hotelId);
    if (!h) return;
    setHotel({
      name: h.name || '',
      location: [h.location, h.destination].filter(Boolean).join(', '),
      address: '',
      contactEmail: h.contactEmail || '',
      contactPhone: h.contactPhone || '',
    });
  }, [hotelId, hotels]);

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
  }, [checkIn, checkOut]);

  const handleSave = async () => {
    if (!hotel.name) { toast.error('Hotel name is required'); return; }
    if (!checkIn || !checkOut) { toast.error('Check-in and check-out are required'); return; }
    if (new Date(checkOut) <= new Date(checkIn)) { toast.error('Check-out must be after check-in'); return; }

    setSaving(true);
    try {
      const payload = {
        hotelId: hotelId || null,
        hotel,
        guest,
        adults: Number(adults) || 0,
        children: Number(children) || 0,
        checkIn,
        checkOut,
        roomType,
        rooms: Number(rooms) || 1,
        mealPlan,
        confirmationNumber,
        bookingReference,
        inclusions: inclusions.map(s => s.trim()).filter(Boolean),
        exclusions: exclusions.map(s => s.trim()).filter(Boolean),
        specialRequests,
        notes,
      };
      if (isEdit) {
        await api.put(`/vouchers/${voucher._id}`, payload);
        toast.success('Voucher updated');
      } else {
        await api.post('/vouchers', { dealId: deal._id, ...payload });
        toast.success('Voucher created');
      }
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-card rounded-xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <h2 className="text-base font-semibold text-foreground">
            {isEdit ? `Edit voucher VCH-${String(voucher.voucherNumber).padStart(4, '0')}` : 'New hotel voucher'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Hotel */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Hotel</label>
            <select
              value={hotelId || ''}
              onChange={e => setHotelId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
            >
              <option value="">— pick from catalog or type below —</option>
              {hotels.map(h => (
                <option key={h._id} value={h._id}>{h.name} · {h.destination}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <input
                placeholder="Hotel name *"
                value={hotel.name}
                onChange={e => setHotel({ ...hotel, name: e.target.value })}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
              <input
                placeholder="Location (e.g. Maasai Mara)"
                value={hotel.location}
                onChange={e => setHotel({ ...hotel, location: e.target.value })}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
              <input
                placeholder="Contact email"
                value={hotel.contactEmail}
                onChange={e => setHotel({ ...hotel, contactEmail: e.target.value })}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
              <input
                placeholder="Contact phone"
                value={hotel.contactPhone}
                onChange={e => setHotel({ ...hotel, contactPhone: e.target.value })}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </div>
          </div>

          {/* Guest */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Lead guest</label>
            <div className="grid grid-cols-3 gap-2">
              <input
                placeholder="Name *"
                value={guest.name}
                onChange={e => setGuest({ ...guest, name: e.target.value })}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
              <input
                placeholder="Email"
                value={guest.email}
                onChange={e => setGuest({ ...guest, email: e.target.value })}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
              <input
                placeholder="Phone"
                value={guest.phone}
                onChange={e => setGuest({ ...guest, phone: e.target.value })}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </div>
          </div>

          {/* Stay */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Check-in *</label>
              <input
                type="date"
                value={checkIn}
                onChange={e => setCheckIn(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Check-out *</label>
              <input
                type="date"
                value={checkOut}
                onChange={e => setCheckOut(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Adults</label>
              <input
                type="number" min="0"
                value={adults}
                onChange={e => setAdults(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Children</label>
              <input
                type="number" min="0"
                value={children}
                onChange={e => setChildren(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-2">{nights} night{nights === 1 ? '' : 's'}</p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Room type</label>
              <input
                placeholder="e.g. Deluxe Tent"
                value={roomType}
                onChange={e => setRoomType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Rooms</label>
              <input
                type="number" min="1"
                value={rooms}
                onChange={e => setRooms(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Meal plan</label>
              <select
                value={mealPlan}
                onChange={e => setMealPlan(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              >
                {MEAL_PLANS.map(mp => <option key={mp.value} value={mp.value}>{mp.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Confirmation #</label>
              <input
                placeholder="Lodge's PRN"
                value={confirmationNumber}
                onChange={e => setConfirmationNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Booking ref (internal)</label>
              <input
                value={bookingReference}
                onChange={e => setBookingReference(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </div>
          </div>

          {/* Inclusions / exclusions — list editor */}
          <ListEditor label="Inclusions" items={inclusions} onChange={setInclusions} placeholder="e.g. All meals, game drives" />
          <ListEditor label="Not included" items={exclusions} onChange={setExclusions} placeholder="e.g. Premium spirits, spa" />

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Special requests</label>
            <textarea
              rows={2}
              value={specialRequests}
              onChange={e => setSpecialRequests(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              placeholder="Honeymoon, dietary, accessibility, etc."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Internal notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-border sticky bottom-0 bg-card">
          <button onClick={onClose} className="px-3 py-2 text-sm rounded-lg hover:bg-muted">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : (isEdit ? 'Save changes' : 'Create voucher')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ListEditor({ label, items, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-xs font-medium text-foreground mb-1">{label}</label>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={item}
              onChange={e => onChange(items.map((x, j) => j === i ? e.target.value : x))}
              placeholder={placeholder}
              className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
            />
            <button
              onClick={() => onChange(items.length === 1 ? [''] : items.filter((_, j) => j !== i))}
              className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-muted"
              title="Remove"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <button
          onClick={() => onChange([...items, ''])}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Plus className="w-3 h-3" /> Add row
        </button>
      </div>
    </div>
  );
}
