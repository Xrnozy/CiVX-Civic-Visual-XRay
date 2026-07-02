const PRODUCTION_MOBILE_DEMO = 'https://civx.xrnozy.me/mobile';

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function isLoopbackUrl(url: string): boolean {
  try {
    return isLoopbackHost(new URL(url).hostname);
  } catch {
    return true;
  }
}

export function mobileDemoBaseUrl(): string {
  const envUrl = import.meta.env.VITE_MOBILE_DEMO_URL as string | undefined;
  if (envUrl?.trim()) return envUrl.trim().replace(/\/$/, '');

  if (typeof window === 'undefined') return PRODUCTION_MOBILE_DEMO;

  if (isLoopbackHost(window.location.hostname)) {
    return PRODUCTION_MOBILE_DEMO;
  }

  return `${window.location.origin}/mobile`;
}

export function mobileDemoUrlForSession(token: string): string {
  return `${mobileDemoBaseUrl()}?session=${encodeURIComponent(token)}`;
}

export function resolveMobileDemoSessionUrl(token: string, apiUrl?: string): string {
  const envUrl = import.meta.env.VITE_MOBILE_DEMO_URL as string | undefined;
  if (envUrl?.trim()) return mobileDemoUrlForSession(token);

  if (apiUrl && !isLoopbackUrl(apiUrl)) {
    return apiUrl;
  }

  return mobileDemoUrlForSession(token);
}
