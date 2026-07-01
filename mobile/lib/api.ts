import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

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

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await AsyncStorage.getItem('civx_token');
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
    throw new Error(text || `Request failed with status ${res.status}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res.text() as unknown as T;
}
