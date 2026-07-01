import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';

function buildFirebaseConfig() {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim() ?? '';
  const authDomain = (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (projectId ? `${projectId}.firebaseapp.com` : '')).trim();
  return { apiKey, authDomain, projectId };
}

const firebaseConfig = buildFirebaseConfig();

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.apiKey !== 'undefined',
);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;

if (isFirebaseConfigured) {
  app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  authInstance = getAuth(app);
}

export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    throw new Error(
      'Firebase is not configured. Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, and VITE_FIREBASE_PROJECT_ID in infra/.env, then restart npm run dev.',
    );
  }
  return authInstance;
}

export const auth = authInstance;
