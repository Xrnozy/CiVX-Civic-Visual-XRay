import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getFirebaseAuth } from './firebase';

function normalizeApiBaseUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/$/, '');
  }
  return `http://${trimmed.replace(/\/$/, '')}`;
}

function resolveApiBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return normalizeApiBaseUrl(process.env.EXPO_PUBLIC_API_URL);
  }

  const hostUri = Constants.expoConfig?.hostUri ?? Constants.manifest?.debuggerHost;
  if (hostUri) {
    const normalizedHost = hostUri.replace(/^https?:\/\//, '').split(':')[0];
    if (normalizedHost && normalizedHost !== 'localhost') {
      return `http://${normalizedHost}:8000`;
    }
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
  if (Platform.OS === 'ios') {
    return 'http://127.0.0.1:8000';
  }
  return 'http://localhost:8000';
}

const API_URL = resolveApiBaseUrl();
const DEFAULT_TIMEOUT_MS = 15000;

async function getStoredOrFirebaseToken(forceRefresh = false) {
  const token = await AsyncStorage.getItem('civx_token');
  if (token && !forceRefresh) return token;

  try {
    const user = getFirebaseAuth().currentUser;
    if (!user) return token;
    const freshToken = await user.getIdToken(forceRefresh);
    await AsyncStorage.setItem('civx_token', freshToken);
    return freshToken;
  } catch {
    return token;
  }
}

function authErrorMessage(status: number, text: string) {
  let detail = text;
  try {
    const parsed = JSON.parse(text) as { detail?: unknown };
    if (typeof parsed.detail === 'string') detail = parsed.detail;
  } catch {
    // Use the raw response text below.
  }

  if (status === 401 && /missing auth token|invalid token/i.test(detail)) {
    return 'Sign in required. Please sign in again to continue.';
  }
  return detail || `Request failed with status ${status}`;
}

async function request<T>(path: string, options: RequestInit, forceRefreshToken = false): Promise<T> {
  const token = await getStoredOrFirebaseToken(forceRefreshToken);
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> | undefined) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Connection timed out. Check that the CiVX backend is running and reachable from this phone.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401 && !forceRefreshToken && token) {
      return request<T>(path, options, true);
    }
    throw new Error(authErrorMessage(res.status, text));
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res.text() as unknown as T;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  return request<T>(path, options);
}
