import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '../lib/firebase';

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
  localStorage.removeItem('civx_token');
  if (isFirebaseConfigured) {
    await signOut(getFirebaseAuth());
  }
}
