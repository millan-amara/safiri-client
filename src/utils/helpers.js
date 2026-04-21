import { clsx } from 'clsx';

export const cn = (...inputs) => clsx(inputs);

// Insert Cloudinary delivery transforms so we don't ship full-resolution originals to grid thumbnails.
// Works only on Cloudinary secure_urls containing `/upload/`; other URLs pass through unchanged.
export const cldThumb = (url, width = 400) => {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('/upload/') || !url.includes('res.cloudinary.com')) return url;
  return url.replace('/upload/', `/upload/w_${width},c_fill,q_auto,f_auto/`);
};

export const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

export const mealPlanLabels = {
  RO: 'Room Only',
  BB: 'Bed & Breakfast',
  HB: 'Half Board',
  FB: 'Full Board',
  AI: 'All Inclusive',
};

export const seasonLabels = {
  low: 'Low Season',
  mid: 'Mid Season',
  high: 'High Season',
  peak: 'Peak Season',
  all: 'All Seasons',
};

export const seasonColors = {
  low: 'bg-blue-100 text-blue-700',
  mid: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  peak: 'bg-red-100 text-red-700',
  all: 'bg-gray-100 text-gray-600',
};