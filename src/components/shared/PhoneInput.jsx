import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

const COMMON_CODES = [
  { code: '+254', country: 'KE', name: 'Kenya' },
  { code: '+1', country: 'US', name: 'United States' },
  { code: '+44', country: 'GB', name: 'United Kingdom' },
  { code: '+49', country: 'DE', name: 'Germany' },
  { code: '+33', country: 'FR', name: 'France' },
  { code: '+39', country: 'IT', name: 'Italy' },
  { code: '+61', country: 'AU', name: 'Australia' },
  { code: '+91', country: 'IN', name: 'India' },
  { code: '+86', country: 'CN', name: 'China' },
  { code: '+81', country: 'JP', name: 'Japan' },
  { code: '+971', country: 'AE', name: 'UAE' },
  { code: '+966', country: 'SA', name: 'Saudi Arabia' },
  { code: '+27', country: 'ZA', name: 'South Africa' },
  { code: '+255', country: 'TZ', name: 'Tanzania' },
  { code: '+256', country: 'UG', name: 'Uganda' },
  { code: '+250', country: 'RW', name: 'Rwanda' },
  { code: '+251', country: 'ET', name: 'Ethiopia' },
  { code: '+31', country: 'NL', name: 'Netherlands' },
  { code: '+34', country: 'ES', name: 'Spain' },
  { code: '+41', country: 'CH', name: 'Switzerland' },
  { code: '+46', country: 'SE', name: 'Sweden' },
  { code: '+47', country: 'NO', name: 'Norway' },
  { code: '+55', country: 'BR', name: 'Brazil' },
  { code: '+7', country: 'RU', name: 'Russia' },
  { code: '+82', country: 'KR', name: 'South Korea' },
  { code: '+64', country: 'NZ', name: 'New Zealand' },
  { code: '+48', country: 'PL', name: 'Poland' },
  { code: '+32', country: 'BE', name: 'Belgium' },
  { code: '+43', country: 'AT', name: 'Austria' },
  { code: '+45', country: 'DK', name: 'Denmark' },
];

// Country flag emoji from country code
const getFlag = (countryCode) => {
  return countryCode
    .toUpperCase()
    .split('')
    .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
    .join('');
};

// Parse an existing phone value into prefix + number
function parsePhone(value) {
  if (!value) return { prefix: '+254', number: '' };
  const str = value.trim();
  // Check if starts with +
  if (str.startsWith('+')) {
    // Find matching code (try longest match first)
    const sorted = [...COMMON_CODES].sort((a, b) => b.code.length - a.code.length);
    for (const c of sorted) {
      if (str.startsWith(c.code)) {
        return { prefix: c.code, number: str.slice(c.code.length).trim() };
      }
    }
    // Unknown prefix — extract digits after +
    const match = str.match(/^(\+\d{1,4})\s*(.*)/);
    if (match) return { prefix: match[1], number: match[2] };
  }
  // No prefix — assume local
  return { prefix: '+254', number: str };
}

export default function PhoneInput({ value, onChange, className = '' }) {
  const parsed = parsePhone(value);
  const [prefix, setPrefix] = useState(parsed.prefix);
  const [number, setNumber] = useState(parsed.number);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropRef = useRef(null);

  // Sync if value changes externally
  useEffect(() => {
    const p = parsePhone(value);
    setPrefix(p.prefix);
    setNumber(p.number);
  }, [value]);

  // Close dropdown on click outside
  useEffect(() => {
    const handle = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const handleChange = (newPrefix, newNumber) => {
    const combined = newNumber ? `${newPrefix} ${newNumber}` : '';
    onChange(combined);
  };

  const filteredCodes = search
    ? COMMON_CODES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.includes(search) ||
        c.country.toLowerCase().includes(search.toLowerCase())
      )
    : COMMON_CODES;

  const currentCountry = COMMON_CODES.find(c => c.code === prefix);

  return (
    <div className={`flex w-full min-w-0 ${className}`} ref={dropRef}>
      {/* Prefix selector */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => { setOpen(!open); setSearch(''); }}
          className="flex items-center gap-1 px-2 py-2 rounded-l-lg bg-muted border border-r-0 border-border text-xs text-foreground hover:bg-muted transition-colors h-full min-w-[72px] max-w-24"
        >
          {currentCountry && <span className="text-sm">{getFlag(currentCountry.country)}</span>}
          <span className="font-medium">{prefix}</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground/70" />
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-card rounded-lg border border-border shadow-lg z-50 animate-scale-in overflow-hidden">
            <div className="p-1.5">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country..."
                className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-xs focus:outline-none focus:border-primary"
                autoFocus
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filteredCodes.map((c) => (
                <button
                  key={c.code + c.country}
                  type="button"
                  onClick={() => {
                    setPrefix(c.code);
                    setOpen(false);
                    handleChange(c.code, number);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-background transition-colors ${
                    prefix === c.code ? 'bg-primary/10 text-primary' : 'text-foreground'
                  }`}
                >
                  <span className="text-sm">{getFlag(c.country)}</span>
                  <span className="flex-1 text-left">{c.name}</span>
                  <span className="text-muted-foreground/70 font-mono">{c.code}</span>
                </button>
              ))}
              {filteredCodes.length === 0 && (
                <p className="text-xs text-muted-foreground/70 text-center py-3">No match</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Number input */}
      <input
        type="tel"
        value={number}
        onChange={(e) => {
          setNumber(e.target.value);
          handleChange(prefix, e.target.value);
        }}
        placeholder="700 123 456"
        className="flex-1 px-3 py-2 rounded-r-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary transition-colors min-w-0"
      />
    </div>
  );
}
