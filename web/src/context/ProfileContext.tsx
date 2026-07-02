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
  loadError: string | null;
  refresh: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user, ready: authReady } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadedUidRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.uid) {
      setProfile(null);
      setLoadError(null);
      loadedUidRef.current = null;
      setReady(true);
      return;
    }
    try {
      const me = await api<UserProfile>('/api/users/me');
      setProfile(me);
      setLoadError(null);
      loadedUidRef.current = user.uid;
      // #region agent log
      fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b92e3'},body:JSON.stringify({sessionId:'8b92e3',location:'ProfileContext.tsx:refresh:ok',message:'profile loaded',data:{uid:user.uid.slice(0,8),role:me.role,registrationCompleted:me.registration_completed},timestamp:Date.now(),hypothesisId:'H-token',runId:'register-debug'})}).catch(()=>{});
      // #endregion
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load profile';
      setLoadError(msg);
      setProfile(null);
      loadedUidRef.current = null;
      // #region agent log
      fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b92e3'},body:JSON.stringify({sessionId:'8b92e3',location:'ProfileContext.tsx:refresh:error',message:'profile fetch failed',data:{error:msg.slice(0,200),uid:user.uid.slice(0,8)},timestamp:Date.now(),hypothesisId:'H-token',runId:'register-debug'})}).catch(()=>{});
      // #endregion
    } finally {
      setReady(true);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!authReady) return;

    if (!user?.uid) {
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
  }, [authReady, user?.uid, refresh]);

  const value: ProfileContextValue = {
    profile,
    ready: authReady && ready,
    loadError,
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
