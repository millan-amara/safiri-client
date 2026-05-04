import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.use({ breaks: true, gfm: true });

// Restrict to formatting tags we actually use in scheduled messages / drafts.
// Anything else (script, iframe, embed, object, form, on*-handlers, javascript: URIs)
// is stripped. DOMPurify enforces this even if the markdown source is hostile.
const ALLOWED_TAGS = [
  'p', 'br', 'hr',
  'strong', 'em', 'u', 's', 'code',
  'ul', 'ol', 'li',
  'blockquote', 'pre',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'a',
];
const ALLOWED_ATTR = ['href', 'title', 'target', 'rel'];

export function renderMarkdownSafe(source) {
  const html = marked.parse(source || '');
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
