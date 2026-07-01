import { getFirebaseAuth, isFirebaseConfigured } from './firebase';

// In dev, use Vite proxy (/api → localhost:8000). In production, use VITE_API_URL.
const API_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');

export async function resolveAuthToken(): Promise<string | null> {
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
    const errBody = await res.text();
    // #region agent log
    fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'76c51b'},body:JSON.stringify({sessionId:'76c51b',location:'api.ts:api',message:'api error',data:{path,status:res.status,hadToken:!!token,errPreview:errBody.slice(0,300)},timestamp:Date.now(),hypothesisId:'H1-H2'})}).catch(()=>{});
    // #endregion
    throw new Error(errBody);
  }
  return res.json();
}
