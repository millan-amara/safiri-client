// ⚠️ MIRROR: this file is duplicated at pdf-service/quoteFormat.js and the two
// MUST stay byte-identical. The PDF renderer is a standalone Puppeteer service
// deployed separately (server reaches it over PDF_SERVICE_URL), so it cannot
// import across package boundaries — the only safe way to share this logic is
// to keep an identical copy on each side. Change one → change the other.
//
// Quote prices are always rendered in en-US convention ($8,493), whole dollars,
// regardless of the client's country. Prices are USD-denominated and a
// locale-formatted USD figure (e.g. de-DE "8.492,76 $") reads as wrong to
// clients. Quote *dates* still localise to the contact's country — that's
// handled separately at each call site.
export const formatQuoteCurrency = (amount, currency = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
