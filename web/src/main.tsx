import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import App from './App';
import './styles/tokens.css';
import { ProfileProvider } from './context/ProfileContext';
import { completeGoogleRedirectIfNeeded, isRegistrationComplete, redirectPathForRole, startAuthTokenSync } from './lib/auth';

function Bootstrap() {
  const navigate = useNavigate();

  useEffect(() => {
    const stopSync = startAuthTokenSync();
    completeGoogleRedirectIfNeeded().then((profile) => {
      if (!profile) return;
      const pending = sessionStorage.getItem('civx_pending_registration');
      if (!isRegistrationComplete(profile)) {
        navigate('/register/complete', { replace: true });
        return;
      }
      if (pending) sessionStorage.removeItem('civx_pending_registration');
      navigate(redirectPathForRole(profile.role), { replace: true });
    });
    return stopSync;
  }, [navigate]);

  return (
    <ProfileProvider>
      <App />
    </ProfileProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Bootstrap />
    </BrowserRouter>
  </StrictMode>,
);
