// API endpoints
const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

// Default to the real API host; local uses FastAPI on 8001.
const rawApiUrl =
  import.meta.env.VITE_API_URL ||
  (isLocal ? 'http://localhost:8001' : 'https://api.optimat.us');

export const API_URL = rawApiUrl.replace(/\/+$/, '');
export const CHAT_API_URL = (
  import.meta.env.VITE_CHAT_API_URL ||
  (isLocal ? 'http://localhost:8002' : 'https://api-chat.optimat.us')
).replace(/\/+$/, '');

/** @param {string | undefined} prefix */
function normalizePrefix(prefix) {
  const value = (prefix ?? '').trim();
  if (value === '' || value === '/') {
    return '';
  }
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.replace(/\/+$/, '');
}

// If API_URL already embeds the providers prefix, avoid doubling it.
function defaultProvidersPrefix() {
  try {
    const url = new URL(API_URL);
    const path = url.pathname.replace(/\/+$/, '');
    if (path.endsWith('/api-providers')) return '';
  } catch {
    // ignore URL parse issues; fall back to default prefix
  }
  return '/api-providers';
}

const rawPrefix = import.meta.env.VITE_API_PREFIX;
const effectivePrefix =
  rawPrefix === undefined
    ? defaultProvidersPrefix()
    : rawPrefix || '/api-providers';

export const PROVIDERS_API_PREFIX = normalizePrefix(effectivePrefix);

export const BACKEND_URL = API_URL;
export const PROVIDERS_API_BASE = `${API_URL}${PROVIDERS_API_PREFIX}`;

export function buildProvidersApiUrl(path = '/') {
  const normalizedPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  return `${PROVIDERS_API_BASE}${normalizedPath}`;
}
