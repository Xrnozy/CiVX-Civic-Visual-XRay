const STORAGE_KEY = 'civx_demo_session_token';

function mobileDemoBaseUrl(): string {
  const envUrl = import.meta.env.VITE_MOBILE_DEMO_URL as string | undefined;
  if (envUrl?.trim()) return envUrl.trim().replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/mobile`;
  }
  return 'https://civx.xrnozy.me/mobile';
}

function generateClientToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 22);
  }
  return `demo${Date.now().toString(36)}`;
}

function stripSessionFromUrl(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('session')) return;
  url.searchParams.delete('session');
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, '', next);
}

/** Demo token for this phone visit only — never read from QR URL. */
export function getDemoSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(STORAGE_KEY);
}

/** Clear any prior demo state and create a new anonymous session on this device. */
export async function startFreshDemoSession(): Promise<string> {
  sessionStorage.removeItem(STORAGE_KEY);
  stripSessionFromUrl();

  try {
    const res = await fetch('/api/demo/sessions', { method: 'POST' });
    if (res.ok) {
      const data = (await res.json()) as { token: string };
      sessionStorage.setItem(STORAGE_KEY, data.token);
      // #region agent log
      fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b92e3'},body:JSON.stringify({sessionId:'8b92e3',runId:'fresh-session',location:'demoSession.ts:startFreshDemoSession',message:'fresh demo session created',data:{source:'api',urlHasSession:false},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return data.token;
    }
  } catch {
    /* fall through */
  }

  const token = generateClientToken();
  sessionStorage.setItem(STORAGE_KEY, token);
  try {
    await fetch(`/api/demo/sessions/${encodeURIComponent(token)}`);
  } catch {
    /* best-effort register */
  }
  // #region agent log
  fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b92e3'},body:JSON.stringify({sessionId:'8b92e3',runId:'fresh-session',location:'demoSession.ts:startFreshDemoSession',message:'fresh demo session created',data:{source:'client',urlHasSession:false},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  return token;
}

/** @deprecated Use startFreshDemoSession on mobile entry. */
export async function ensureDemoSession(): Promise<string> {
  const existing = getDemoSessionToken();
  if (existing) return existing;
  return startFreshDemoSession();
}

export async function demoApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getDemoSessionToken() || (await startFreshDemoSession());
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
    'X-Demo-Session': token,
  };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  const res = await fetch(path, { ...options, headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export { mobileDemoBaseUrl };
