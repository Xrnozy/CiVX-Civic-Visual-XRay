import { getFirebaseAuth, isFirebaseConfigured } from './firebase';

// Relative /api when unset — works with Vite dev proxy and Caddy same-origin in production.
const API_URL = import.meta.env.VITE_API_URL || '';

let cachedToken: string | null = null;
let cachedTokenExpiry = 0;

export async function resolveAuthToken(forceRefresh = false): Promise<string | null> {
  if (!forceRefresh && cachedToken && Date.now() < cachedTokenExpiry) {
    return cachedToken;
  }

  if (isFirebaseConfigured) {
    const auth = getFirebaseAuth();
    await auth.authStateReady();
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken(forceRefresh);
      cachedToken = token;
      cachedTokenExpiry = Date.now() + 50_000;
      localStorage.setItem('civx_token', token);
      return token;
    }
  }

  cachedToken = localStorage.getItem('civx_token');
  if (cachedToken) {
    cachedTokenExpiry = Date.now() + 50_000;
  }
  return cachedToken;
}

export function clearAuthTokenCache(): void {
  cachedToken = null;
  cachedTokenExpiry = 0;
}

async function fetchWithAuth<T>(path: string, options: RequestInit, token: string | null): Promise<Response> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  return fetch(`${API_URL}${path}`, { ...options, headers });
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let token = await resolveAuthToken();
  let res = await fetchWithAuth(path, options, token);

  if (res.status === 401 && isFirebaseConfigured) {
    token = await resolveAuthToken(true);
    res = await fetchWithAuth(path, options, token);
  }

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(errBody);
  }
  return res.json();
}
