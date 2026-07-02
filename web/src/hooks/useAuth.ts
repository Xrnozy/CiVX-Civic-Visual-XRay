import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '../lib/firebase';
import { clearAuthTokenCache } from '../lib/api';
import { clearPendingRegistration } from '../lib/pendingRegistration';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const unsub = onAuthStateChanged(getFirebaseAuth(), (u) => {
      setUser(u);
      setReady(true);
    });
    return unsub;
  }, []);

  return { user, ready };
}

export async function signOutUser(): Promise<void> {
  clearAuthTokenCache();
  clearPendingRegistration();
  localStorage.removeItem('civx_token');
  if (isFirebaseConfigured) {
    await signOut(getFirebaseAuth());
  }
}

/** Sign out when switching to a different email/password account. */
export async function ensureSignedOutForCredential(email: string): Promise<void> {
  if (!isFirebaseConfigured) return;
  const current = getFirebaseAuth().currentUser;
  if (!current) return;
  const nextEmail = email.trim().toLowerCase();
  const currentEmail = current.email?.trim().toLowerCase();
  if (currentEmail && nextEmail && currentEmail === nextEmail) return;
  await signOutUser();
}
