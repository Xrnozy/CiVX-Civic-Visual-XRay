import { getFirebaseAuth, isFirebaseConfigured } from './firebase';

// In dev, use Vite proxy (/api → localhost:8000). In production, use VITE_API_URL.
const API_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');

async function resolveAuthToken(): Promise<string | null> {
  if (isFirebaseConfigured) {
    const auth = getFirebaseAuth();
    await auth.authStateReady();
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      localStorage.setItem('civx_token', token);
      return token;
    }
  }
  return localStorage.getItem('civx_token');
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await resolveAuthToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}
