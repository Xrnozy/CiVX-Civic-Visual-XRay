import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';

function buildConfig() {
  const projectId = (process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '').trim();
  const apiKey = (process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '').trim();
  const authDomain = (process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || (projectId ? `${projectId}.firebaseapp.com` : '')).trim();
  return { apiKey, authDomain, projectId };
}

const config = buildConfig();

export const isFirebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;

if (isFirebaseConfigured) {
  app = getApps().length > 0 ? getApps()[0] : initializeApp(config);
  authInstance = getAuth(app);
}

export function getFirebaseAuth(): Auth {
  if (!authInstance) throw new Error('Firebase not configured');
  return authInstance;
}

export const auth = authInstance;
