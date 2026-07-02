import { Navigate, useLocation } from 'react-router-dom';
import { ButtonPrimary } from '../ui/Buttons';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';
import { isRegistrationComplete, redirectPathForRole } from '../../lib/auth';

const COMPLETE_PATH = '/register/complete';
const DEMO_PATHS = ['/mobile'];

function isCompleteRegistrationPath(pathname: string): boolean {
  return pathname === COMPLETE_PATH || pathname.startsWith(`${COMPLETE_PATH}?`);
}

function isGuestAuthPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname.startsWith('/login?') ||
    pathname === '/register' ||
    pathname.startsWith('/register?')
  );
}

function isNetworkError(message: string | null): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes('failed to fetch') || lower.includes('network') || lower.includes('load failed');
}

export function RegistrationGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, ready: authReady } = useAuth();
  const { profile, ready: profileReady, loadError, refresh } = useProfile();

  const isDemoPath = DEMO_PATHS.some((p) => location.pathname.startsWith(p));

  if (!authReady || (user && !profileReady && !isDemoPath)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-ink-muted-48">
        Loading…
      </div>
    );
  }

  if (!user) return <>{children}</>;

  if (isDemoPath) return <>{children}</>;

  if (user && profileReady && !profile && loadError) {
    const offline = isNetworkError(loadError);
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-semibold text-ink">
          {offline ? 'Cannot reach CiVX server' : 'Could not load your profile'}
        </p>
        <p className="max-w-md text-sm text-ink-muted-48">
          {offline
            ? 'The API at localhost:8000 may be stopped. Start the backend, then retry.'
            : loadError}
        </p>
        <ButtonPrimary type="button" className="justify-center" onClick={() => void refresh()}>
          Retry
        </ButtonPrimary>
      </div>
    );
  }

  const needsRegistration = Boolean(
    user && profileReady && profile && !isRegistrationComplete(profile),
  );
  const onCompletePath = isCompleteRegistrationPath(location.pathname);
  const onGuestAuthPath = isGuestAuthPath(location.pathname);

  // #region agent log
  if (profileReady && user) {
    fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b92e3'},body:JSON.stringify({sessionId:'8b92e3',location:'RegistrationGate.tsx',message:'route decision',data:{pathname:location.pathname,needsRegistration,registrationCompleted:profile?isRegistrationComplete(profile):null,onCompletePath,onGuestAuthPath},timestamp:Date.now(),hypothesisId:'H-register-redirect',runId:'post-fix'})}).catch(()=>{});
  }
  // #endregion

  // Incomplete profiles may only finish on /register/complete — not /register or app routes.
  if (needsRegistration && !onCompletePath) {
    const invite = new URLSearchParams(location.search).get('invite');
    return <Navigate to={`${COMPLETE_PATH}${invite ? `?invite=${invite}` : ''}`} replace />;
  }

  // Fully registered users should not stay on login/register/complete screens.
  if (!needsRegistration && (onCompletePath || onGuestAuthPath)) {
    return <Navigate to={profile ? redirectPathForRole(profile.role) : '/map'} replace />;
  }

  return <>{children}</>;
}
