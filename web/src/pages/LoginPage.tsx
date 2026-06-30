import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GlobalNav } from '../components/ui/GlobalNav';
import { ButtonPrimary } from '../components/ui/Buttons';
import { isFirebaseConfigured } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import {
  authErrorMessage,
  GoogleRedirectStartedError,
  persistAuthSession,
  POST_AUTH_PATH,
  registerWithEmail,
  signInWithEmail,
  signInWithGoogle,
} from '../lib/auth';

type AuthMode = 'signin' | 'register';

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, ready } = useAuth();
  const nextPath = new URLSearchParams(location.search).get('next') || POST_AUTH_PATH;

  useEffect(() => {
    if (ready && user) navigate(nextPath, { replace: true });
  }, [ready, user, navigate, nextPath]);

  async function completeAuth(cred: Awaited<ReturnType<typeof signInWithEmail>>) {
    try {
      await persistAuthSession(cred);
    } catch (sessionErr) {
      if (import.meta.env.DEV) {
        console.error('[auth] persistAuthSession failed after Firebase auth succeeded', sessionErr);
      }
      throw sessionErr;
    }
    navigate(nextPath);
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
      const cred =
        mode === 'register'
          ? await registerWithEmail(email, password, fullName)
          : await signInWithEmail(email, password);
      await completeAuth(cred);
    } catch (err) {
      if (!(err instanceof GoogleRedirectStartedError)) {
        setError(authErrorMessage(err));
      }
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
      const cred = await signInWithGoogle();
      await completeAuth(cred);
    } catch (err) {
      if (err instanceof GoogleRedirectStartedError) {
        setError('Redirecting to Google sign-in…');
        return;
      }
      setError(authErrorMessage(err));
      setLoading(false);
      return;
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-canvas-parchment">
      <GlobalNav />
      <div className="flex min-h-[calc(100vh-44px)] items-center justify-center px-6 py-16">
        <div className="auth-card w-full max-w-md">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Account</p>
          <h1 className="mt-2 text-[40px] font-semibold tracking-tight text-ink">
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </h1>
          <p className="mt-2 text-sm text-ink-muted-48">
            {mode === 'signin'
              ? 'Access the community map, report issues, and volunteer tools.'
              : 'Join CiVX to report civic issues and participate in your community.'}
          </p>

          {!isFirebaseConfigured && (
            <div className="mt-6 rounded-[18px] border border-hairline bg-canvas-parchment p-4 text-sm text-ink-muted-80">
              <p className="font-semibold text-ink">Firebase not configured</p>
              <p className="mt-2">
                Set Firebase keys in <code className="text-primary">infra/.env</code>, then restart{' '}
                <code>npm run dev</code>.
              </p>
            </div>
          )}

          <div className="mt-8 flex rounded-full border border-hairline bg-canvas-parchment p-1">
            <button
              type="button"
              className={`flex-1 rounded-full py-2 text-sm font-medium transition ${mode === 'signin' ? 'bg-canvas text-ink shadow-sm' : 'text-ink-muted-48'}`}
              onClick={() => { setMode('signin'); setError(''); }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`flex-1 rounded-full py-2 text-sm font-medium transition ${mode === 'register' ? 'bg-canvas text-ink shadow-sm' : 'text-ink-muted-48'}`}
              onClick={() => { setMode('register'); setError(''); }}
            >
              Register
            </button>
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading || !isFirebaseConfigured}
            className="btn-google mt-6 w-full"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-hairline" />
            <span className="text-xs text-ink-muted-48">or use email</span>
            <div className="h-px flex-1 bg-hairline" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <input
                className="auth-input"
                type="text"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            )}
            <input
              className="auth-input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <input
              className="auth-input"
              type="password"
              placeholder={mode === 'register' ? 'Password (min. 6 characters)' : 'Password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <ButtonPrimary type="submit" className="w-full justify-center" disabled={loading}>
              {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </ButtonPrimary>
          </form>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.083 36 24 36c-5.522 0-10-4.478-10-10s4.478-10 10-10c2.837 0 5.402 1.193 7.207 3.104l5.657-5.657C33.64 10.053 29.082 8 24 8 12.954 8 4 16.954 4 28s8.954 20 20 20 20-8.954 20-20c0-1.341-.138-2.651-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c2.837 0 5.402 1.193 7.207 3.104l5.657-5.657C33.64 10.053 29.082 8 24 8 16.318 8 9.656 13.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 48c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 39.091 26.715 40 24 40c-5.067 0-9.421-3.248-11.007-7.786l-6.52 5.02C9.505 43.09 16.227 48 24 48z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-1.341-.138-2.651-.389-3.917z" />
    </svg>
  );
}
