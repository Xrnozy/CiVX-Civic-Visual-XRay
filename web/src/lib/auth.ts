import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  updateProfile,
  UserCredential,
} from 'firebase/auth';
import { getFirebaseAuth } from './firebase';
import { api } from './api';

export async function persistAuthSession(cred: UserCredential): Promise<void> {
  const token = await cred.user.getIdToken(true);
  localStorage.setItem('civx_token', token);
  try {
    await api('/api/users/me');
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[auth] /api/users/me sync failed; login still succeeded', err);
    }
  }
}

/** Call on app load to complete Google redirect sign-in. */
export async function completeGoogleRedirectIfNeeded(): Promise<UserCredential | null> {
  try {
    const result = await getRedirectResult(getFirebaseAuth());
    if (!result) return null;
    await persistAuthSession(result);
    return result;
  } catch {
    return null;
  }
}

export async function signInWithEmail(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export async function registerWithEmail(
  email: string,
  password: string,
  fullName?: string,
): Promise<UserCredential> {
  const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
  if (fullName?.trim()) {
    try {
      await updateProfile(cred.user, { displayName: fullName.trim() });
      await cred.user.reload();
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[auth] updateProfile failed after registration; account was still created', err);
      }
    }
  }
  return cred;
}

export async function signInWithGoogle(): Promise<UserCredential> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    return await signInWithPopup(getFirebaseAuth(), provider);
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
      await signInWithRedirect(getFirebaseAuth(), provider);
      throw new GoogleRedirectStartedError();
    }
    throw err;
  }
}

export class GoogleRedirectStartedError extends Error {
  constructor() {
    super('Redirecting to Google sign-in…');
    this.name = 'GoogleRedirectStartedError';
  }
}

export function authErrorMessage(err: unknown): string {
  if (err instanceof GoogleRedirectStartedError) {
    return 'Redirecting to Google sign-in…';
  }

  const code = (err as { code?: string })?.code;
  const message = (err as { message?: string })?.message;

  if (import.meta.env.DEV) {
    console.error('[auth] Firebase error:', code ?? '(no code)', message ?? err);
  }

  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is disabled. In Firebase Console → Authentication → Sign-in method, enable Email/Password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in or use Google if you registered that way.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/missing-password':
      return 'Please enter your password.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'Incorrect email or password. New here? Switch to Register.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key':
      return 'Firebase API key is invalid. Use the Web API Key from Firebase Console → Project settings (not the Google Maps key).';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was cancelled.';
    case 'auth/popup-blocked':
      return 'Popup blocked — retrying with redirect…';
    case 'auth/account-exists-with-different-credential':
      return 'This email is registered with Google. Use Continue with Google instead.';
    case 'auth/credential-already-in-use':
      return 'This sign-in method is already linked to another account.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized. Add localhost to Firebase Console → Authentication → Settings → Authorized domains.';
    default:
      if (import.meta.env.DEV && code) {
        return `Authentication failed (${code}). See browser console for details.`;
      }
      return 'Authentication failed. Please try again.';
  }
}
