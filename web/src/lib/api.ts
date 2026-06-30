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
      // #region agent log
      fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b92e3'},body:JSON.stringify({sessionId:'8b92e3',location:'api.ts:resolveAuthToken',message:'token from firebase user',data:{hasToken:!!token,len:token?.length??0},timestamp:Date.now(),hypothesisId:'H1',runId:'token-fix'})}).catch(()=>{});
      // #endregion
      return token;
    }
  }
  const stored = localStorage.getItem('civx_token');
  // #region agent log
  fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b92e3'},body:JSON.stringify({sessionId:'8b92e3',location:'api.ts:resolveAuthToken',message:'token from localStorage only',data:{hasStored:!!stored,len:stored?.length??0,firebaseConfigured:isFirebaseConfigured},timestamp:Date.now(),hypothesisId:'H1',runId:'token-fix'})}).catch(()=>{});
  // #endregion
  return stored;
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
    // #region agent log
    fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b92e3'},body:JSON.stringify({sessionId:'8b92e3',location:'api.ts:api',message:'api error',data:{path,status:res.status,hadToken:!!token},timestamp:Date.now(),hypothesisId:'H2',runId:'token-fix'})}).catch(()=>{});
    // #endregion
    throw new Error(await res.text());
  }
  return res.json();
}
