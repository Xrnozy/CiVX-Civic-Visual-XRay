import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  updateProfile,
  User,
  UserCredential,
} from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from './firebase';
import { api } from './api';
import type { AccountType, UserProfile } from '../types/user';

export function redirectPathForRole(role: string): string {
  switch (role) {
    case 'organizer':
      return '/organizer';
    case 'street_sweeper':
      return '/worker';
    case 'field_checker':
      return '/dispatch';
    case 'lgu_admin':
    case 'lgu_staff':
    case 'field_worker':
      return '/lgu';
    default:
      return '/map';
  }
}

export function isRegistrationComplete(
  profile: Pick<UserProfile, 'registration_completed' | 'registration_completed_at'> | null | undefined,
): boolean {
  if (!profile) return false;
  return !!(profile.registration_completed || profile.registration_completed_at);
}

export interface CompleteRegistrationPayload {
  account_type: AccountType;
  full_name: string;
  phone_number: string;
  barangay: string;
  organization_name?: string;
  organization_logo_url?: string;
  profile_photo_url?: string;
  invite_token?: string;
  public_worker_type?: string;
}

export async function completeRegistration(payload: CompleteRegistrationPayload): Promise<UserProfile> {
  return api<UserProfile>('/api/users/complete-registration', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchProfileAfterAuth(): Promise<UserProfile> {
  return api<UserProfile>('/api/users/me');
}

/** Keep localStorage token in sync with the Firebase client session. */
export async function syncAuthTokenFromFirebase(user: User | null): Promise<string | null> {
  if (!user) {
    localStorage.removeItem('civx_token');
    return null;
  }
  const token = await user.getIdToken();
  localStorage.setItem('civx_token', token);
  return token;
}

export function startAuthTokenSync(): () => void {
  if (!isFirebaseConfigured) return () => {};
  return onAuthStateChanged(getFirebaseAuth(), (user) => {
    void syncAuthTokenFromFirebase(user);
  });
}

export async function persistAuthSession(cred: UserCredential): Promise<UserProfile> {
  await syncAuthTokenFromFirebase(cred.user);
  return fetchProfileAfterAuth();
}

let redirectResultHandled = false;

/** Completes Google redirect sign-in when popup fallback was used. */
export async function completeGoogleRedirectIfNeeded(): Promise<UserProfile | null> {
  if (redirectResultHandled) return null;
  try {
    const result = await getRedirectResult(getFirebaseAuth());
    if (!result) return null;
    redirectResultHandled = true;
    return await persistAuthSession(result);
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

/** Popup sign-in with auth-state fallback when COOP blocks popup promise resolution. */
export async function signInWithGoogle(): Promise<UserCredential> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const priorUid = auth.currentUser?.uid ?? null;

  const authStatePromise = new Promise<UserCredential>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      unsub();
      reject(Object.assign(new Error('Google sign-in timed out'), { code: 'auth/popup-timeout' }));
    }, 120_000);
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user && user.uid !== priorUid) {
        clearTimeout(timeout);
        unsub();
        resolve({ user } as UserCredential);
      }
    });
  });

  try {
    return await Promise.race([signInWithPopup(auth, provider), authStatePromise]);
  } catch (err) {
    if (auth.currentUser && auth.currentUser.uid !== priorUid) {
      return { user: auth.currentUser } as UserCredential;
    }
    const code = (err as { code?: string })?.code;
    if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
      await signInWithRedirect(auth, provider);
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
