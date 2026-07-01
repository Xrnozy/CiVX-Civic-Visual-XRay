import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';
import { isRegistrationComplete, redirectPathForRole } from '../../lib/auth';

const COMPLETE_PATH = '/register/complete';
const AUTH_PATHS = ['/login', '/register', COMPLETE_PATH];

export function RegistrationGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, ready: authReady } = useAuth();
  const { profile, ready: profileReady } = useProfile();

  if (!authReady || (user && !profileReady)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-ink-muted-48">
        Loading…
      </div>
    );
  }

  if (!user) return <>{children}</>;

  const onAuthPath = AUTH_PATHS.some((p) => location.pathname.startsWith(p));
  const needsRegistration = profile && !isRegistrationComplete(profile);

  if (needsRegistration && !onAuthPath) {
    const invite = new URLSearchParams(location.search).get('invite');
    return <Navigate to={`${COMPLETE_PATH}${invite ? `?invite=${invite}` : ''}`} replace />;
  }

  if (!needsRegistration && location.pathname === COMPLETE_PATH) {
    return <Navigate to={profile ? redirectPathForRole(profile.role) : '/map'} replace />;
  }

  return <>{children}</>;
}
