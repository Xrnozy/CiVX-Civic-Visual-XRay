import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import type { UserProfile } from '../types/user';

interface ProfileContextValue {
  profile: UserProfile | null;
  ready: boolean;
  refresh: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user, ready: authReady } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);
  const loadedUidRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setProfile(null);
      loadedUidRef.current = null;
      setReady(true);
      return;
    }
    try {
      const me = await api<UserProfile>('/api/users/me');
      setProfile(me);
      loadedUidRef.current = user.uid;
    } catch {
      /* keep last known profile so nav links do not flicker */
    } finally {
      setReady(true);
    }
  }, [user]);

  useEffect(() => {
    if (!authReady) return;

    if (!user) {
      setProfile(null);
      loadedUidRef.current = null;
      setReady(true);
      return;
    }

    const isNewUser = loadedUidRef.current !== user.uid;
    if (isNewUser) {
      setProfile(null);
      setReady(false);
    }

    void refresh();
  }, [authReady, user, refresh]);

  const value: ProfileContextValue = {
    profile,
    ready: authReady && ready,
    refresh,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error('useProfile must be used within ProfileProvider');
  }
  return ctx;
}
