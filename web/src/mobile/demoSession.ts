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

export function getDemoSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('session');
  if (fromUrl) {
    sessionStorage.setItem(STORAGE_KEY, fromUrl);
    return fromUrl;
  }
  return sessionStorage.getItem(STORAGE_KEY);
}

export async function ensureDemoSession(): Promise<string> {
  const existing = getDemoSessionToken();
  if (existing) {
    try {
      const res = await fetch(`/api/demo/sessions/${encodeURIComponent(existing)}`);
      if (res.ok) return existing;
    } catch {
      /* fall through */
    }
  }

  try {
    const res = await fetch('/api/demo/sessions', { method: 'POST' });
    if (res.ok) {
      const data = (await res.json()) as { token: string };
      sessionStorage.setItem(STORAGE_KEY, data.token);
      const url = new URL(window.location.href);
      url.searchParams.set('session', data.token);
      window.history.replaceState({}, '', url.toString());
      return data.token;
    }
  } catch {
    /* fall through */
  }

  const token = existing || generateClientToken();
  sessionStorage.setItem(STORAGE_KEY, token);
  const url = new URL(window.location.href);
  url.searchParams.set('session', token);
  window.history.replaceState({}, '', url.toString());

  try {
    await fetch(`/api/demo/sessions/${encodeURIComponent(token)}`);
  } catch {
    /* best-effort register */
  }

  return token;
}

export async function demoApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getDemoSessionToken() || (await ensureDemoSession());
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
