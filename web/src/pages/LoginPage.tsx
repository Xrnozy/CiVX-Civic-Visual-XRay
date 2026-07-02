import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { GlobalNav } from '../components/ui/GlobalNav';
import { ButtonPrimary } from '../components/ui/Buttons';
import { getFirebaseAuth, isFirebaseConfigured } from '../lib/firebase';
import { useAuth, ensureSignedOutForCredential, signOutUser } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import {
  authErrorMessage,
  GoogleRedirectStartedError,
  isRegistrationComplete,
  persistAuthSession,
  redirectPathForRole,
  signInWithEmail,
  signInWithGoogle,
} from '../lib/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, ready } = useAuth();
  const { profile, ready: profileReady } = useProfile();
  const nextPath = new URLSearchParams(location.search).get('next');
  const sessionFromUrl = new URLSearchParams(location.search).get('session');

  useEffect(() => {
    if (sessionFromUrl) {
      sessionStorage.setItem('civx_demo_session_token', sessionFromUrl);
    }
  }, [sessionFromUrl]);

  useEffect(() => {
    if (!ready || !user || !profileReady || loading) return;
    if (profile && !isRegistrationComplete(profile)) {
      navigate('/register/complete', { replace: true });
      return;
    }
    navigate(nextPath || (profile ? redirectPathForRole(profile.role) : '/map'), { replace: true });
  }, [ready, user, profile, profileReady, navigate, nextPath, loading]);

  async function afterSignIn() {
    const profile = await persistAuthSession(
      await signInWithEmail(email, password).catch(() => {
        throw new Error('sign-in failed');
      }),
    );
    if (!isRegistrationComplete(profile)) {
      navigate('/register/complete', { replace: true });
      return;
    }
    navigate(nextPath || redirectPathForRole(profile.role));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFirebaseConfigured) {
      setError('Firebase is not configured. Add keys to infra/.env and restart the dev server.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await ensureSignedOutForCredential(email);
      const cred = await signInWithEmail(email, password);
      const profile = await persistAuthSession(cred);
      if (!isRegistrationComplete(profile)) {
        navigate('/register/complete', { replace: true });
        return;
      }
      navigate(nextPath || redirectPathForRole(profile.role));
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (!isFirebaseConfigured) {
      setError('Firebase is not configured. Add keys to infra/.env and restart the dev server.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (getFirebaseAuth().currentUser) {
        await signOutUser();
      }
      const cred = await signInWithGoogle();
      const profile = await persistAuthSession(cred);
      if (!isRegistrationComplete(profile)) {
        navigate('/register/complete', { replace: true });
        return;
      }
      navigate(nextPath || redirectPathForRole(profile.role));
    } catch (err) {
      if (err instanceof GoogleRedirectStartedError) {
        setError('Redirecting to Google sign-in…');
        return;
      }
      setError(authErrorMessage(err));
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas-parchment">
      <GlobalNav />
      <div className="flex min-h-[calc(100vh-44px)] items-center justify-center px-6 py-16">
        <div className="auth-card w-full max-w-md">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Account</p>
          <h1 className="mt-2 text-[40px] font-semibold tracking-tight text-ink">Sign in</h1>
          <p className="mt-2 text-sm text-ink-muted-48">Access the community map, report issues, and volunteer tools.</p>

          <button type="button" onClick={handleGoogle} disabled={loading || !isFirebaseConfigured} className="btn-google mt-8 w-full">
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-hairline" />
            <span className="text-xs text-ink-muted-48">or use email</span>
            <div className="h-px flex-1 bg-hairline" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input className="auth-input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input className="auth-input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <ButtonPrimary type="submit" className="w-full justify-center" disabled={loading}>
              {loading ? 'Please wait…' : 'Sign In'}
            </ButtonPrimary>
          </form>

          <p className="mt-8 text-center text-sm text-ink-muted-48">
            New here? <Link to="/register" className="text-primary">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
