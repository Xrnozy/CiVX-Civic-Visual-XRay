import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import App from './App';
import './styles/tokens.css';
import { ProfileProvider, useProfile } from './context/ProfileContext';
import {
  completeGoogleRedirectIfNeeded,
  isRegistrationComplete,
  redirectPathForRole,
  startAuthTokenSync,
} from './lib/auth';
import { clearPendingRegistration, loadPendingRegistration } from './lib/pendingRegistration';
import { tryCompletePendingRegistration } from './lib/finishRegistrationFlow';

function Bootstrap() {
  const navigate = useNavigate();
  const { refresh } = useProfile();

  useEffect(() => {
    const stopSync = startAuthTokenSync();
    completeGoogleRedirectIfNeeded().then(async (profile) => {
      if (!profile) return;
      const pending = loadPendingRegistration();
      if (!isRegistrationComplete(profile)) {
        if (pending) {
          const result = await tryCompletePendingRegistration(pending);
          if (result.completed && result.role) {
            await refresh();
            navigate(redirectPathForRole(result.role), { replace: true });
            return;
          }
        }
        navigate('/register/complete', { replace: true });
        return;
      }
      if (pending) clearPendingRegistration();
      navigate(redirectPathForRole(profile.role), { replace: true });
    });
    return stopSync;
  }, [navigate, refresh]);

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ProfileProvider>
        <Bootstrap />
      </ProfileProvider>
    </BrowserRouter>
  </StrictMode>,
);
