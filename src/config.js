// API endpoints
const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

// Supabase configuration
export const USE_SUPABASE = import.meta.env.VITE_USE_SUPABASE === 'true';
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

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
// For local dev (direct to FastAPI), no prefix needed.
// For production (via nginx), use /api-providers prefix.
function defaultProvidersPrefix() {
  // Local dev: FastAPI runs at root, no prefix needed
  if (isLocal) return '';

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
// If VITE_API_PREFIX is explicitly set (even to empty string), use it.
// Only fall back to defaultProvidersPrefix() when undefined.
const effectivePrefix =
  rawPrefix !== undefined
    ? rawPrefix
    : defaultProvidersPrefix();

export const PROVIDERS_API_PREFIX = normalizePrefix(effectivePrefix);

export const BACKEND_URL = API_URL;
export const PROVIDERS_API_BASE = `${API_URL}${PROVIDERS_API_PREFIX}`;

export function buildProvidersApiUrl(path = '/') {
  const normalizedPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  return `${PROVIDERS_API_BASE}${normalizedPath}`;
}
