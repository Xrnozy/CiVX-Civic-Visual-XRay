import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { GlobalNav } from '../components/ui/GlobalNav';
import { ButtonPrimary } from '../components/ui/Buttons';
import { getFirebaseAuth, isFirebaseConfigured } from '../lib/firebase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!isFirebaseConfigured) {
      setError('Firebase is not configured. Add keys to web/.env.local and restart the dev server.');
      return;
    }
    try {
      const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      const token = await cred.user.getIdToken();
      localStorage.setItem('civx_token', token);
      navigate('/lgu');
    } catch {
      setError('Login failed. Check credentials or Firebase config.');
    }
  }

  return (
    <div className="min-h-screen bg-canvas-parchment">
      <GlobalNav />
      <div className="flex min-h-[calc(100vh-44px)] items-center justify-center px-6 py-16">
        <div className="auth-card w-full max-w-md">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Account</p>
          <h1 className="mt-2 text-[40px] font-semibold tracking-tight text-ink">Sign in</h1>
          <p className="mt-2 text-sm text-ink-muted-48">Access the LGU dashboard and volunteer tools.</p>
          {!isFirebaseConfigured && (
            <div className="mt-6 rounded-[18px] border border-hairline bg-canvas-parchment p-4 text-sm text-ink-muted-80">
              <p className="font-semibold text-ink">Firebase not configured</p>
              <p className="mt-2">Copy <code className="text-primary">web/.env.example</code> to <code className="text-primary">web/.env.local</code>, add your Firebase web app keys, then restart <code>npm run dev</code>.</p>
            </div>
          )}
          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <input className="auth-input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input className="auth-input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <ButtonPrimary type="submit" className="w-full justify-center">Sign In</ButtonPrimary>
          </form>
        </div>
      </div>
    </div>
  );
}
