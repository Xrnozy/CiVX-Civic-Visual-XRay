import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { GlobalNav } from '../components/ui/GlobalNav';
import { ButtonDark, ButtonPrimary } from '../components/ui/Buttons';
import { InviteQrCapture } from '../components/auth/InviteQrCapture';
import { WorkerTypeSelect } from '../components/auth/WorkerTypeSelect';
import { isFirebaseConfigured } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import {
  authErrorMessage,
  completeRegistration,
  GoogleRedirectStartedError,
  persistAuthSession,
  redirectPathForRole,
  registerWithEmail,
  signInWithGoogle,
} from '../lib/auth';
import { api } from '../lib/api';
import type { AccountType, InviteValidation, PublicWorkerType } from '../types/user';
import { ACCOUNT_TYPE_LABELS } from '../types/user';

type Step = 'type' | 'details' | 'credentials';

const STEP_LABELS: Record<Step, string> = {
  type: 'Account type',
  details: 'Your details',
  credentials: 'Sign in',
};

const ACCOUNT_OPTIONS: {
  type: AccountType;
  icon: string;
  iconClass: string;
  description: string;
}[] = [
  {
    type: 'citizen',
    icon: '🏘️',
    iconClass: 'account-type-icon-citizen',
    description: 'Report issues, join events, and volunteer in your barangay.',
  },
  {
    type: 'organizer',
    icon: '🤝',
    iconClass: 'account-type-icon-organizer',
    description: 'Lead an NGO and organize cleanup drives for your community.',
  },
];

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const inviteFromUrl = searchParams.get('invite') ?? '';
  const [step, setStep] = useState<Step>(inviteFromUrl ? 'details' : 'type');
  const [accountType, setAccountType] = useState<AccountType | null>(
    inviteFromUrl ? 'street_sweeper' : null,
  );
  const [inviteToken, setInviteToken] = useState(inviteFromUrl);
  const [inviteInfo, setInviteInfo] = useState<InviteValidation | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [barangay, setBarangay] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [publicWorkerType, setPublicWorkerType] = useState<PublicWorkerType | ''>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, ready } = useAuth();

  const steps: Step[] = ['type', 'details', 'credentials'];
  const stepIndex = steps.indexOf(step);

  useEffect(() => {
    if (ready && user) navigate('/register/complete', { replace: true });
  }, [ready, user, navigate]);

  useEffect(() => {
    if (!inviteToken || accountType !== 'street_sweeper') return;
    api<InviteValidation>(`/api/registration-invites/validate?token=${encodeURIComponent(inviteToken)}`)
      .then((info) => {
        setInviteInfo(info);
        if (info.barangay) setBarangay(info.barangay);
      })
      .catch(() => setInviteInfo({ valid: false, status: 'invalid' }));
  }, [inviteToken, accountType]);

  function selectType(type: AccountType) {
    setAccountType(type);
    setError('');
    if (type === 'street_sweeper' && !inviteToken) {
      setError('Scan or upload your LGU worker QR code first.');
      return;
    }
    setStep('details');
  }

  async function handleCredentials(e: FormEvent) {
    e.preventDefault();
    if (!accountType || !isFirebaseConfigured) return;
    if (accountType === 'street_sweeper' && inviteInfo && !inviteInfo.valid) {
      setError('Worker invite is invalid or expired.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const cred = await registerWithEmail(email, password, fullName);
      await persistAuthSession(cred);
      const profile = await completeRegistration({
        account_type: accountType,
        full_name: fullName,
        phone_number: phone,
        barangay,
        organization_name: accountType === 'organizer' ? organizationName : undefined,
        invite_token: accountType === 'street_sweeper' ? inviteToken : undefined,
        public_worker_type: accountType === 'street_sweeper' ? publicWorkerType || undefined : undefined,
      });
      navigate(redirectPathForRole(profile.role));
    } catch (err) {
      if (!(err instanceof GoogleRedirectStartedError)) {
        setError(authErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (!accountType || !isFirebaseConfigured) return;
    if (accountType === 'street_sweeper' && !publicWorkerType) {
      setError('Select what type of public worker you are.');
      return;
    }
    sessionStorage.setItem(
      'civx_pending_registration',
      JSON.stringify({
        account_type: accountType,
        full_name: fullName,
        phone_number: phone,
        barangay,
        organization_name: organizationName,
        invite_token: inviteToken,
        public_worker_type: publicWorkerType,
      }),
    );
    setLoading(true);
    setError('');
    try {
      // #region agent log
      fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'76c51b'},body:JSON.stringify({sessionId:'76c51b',location:'RegisterPage.tsx:handleGoogle',message:'google register start',data:{accountType,hasPending:!!sessionStorage.getItem('civx_pending_registration')},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      const cred = await signInWithGoogle();
      await persistAuthSession(cred);
      const pending = JSON.parse(sessionStorage.getItem('civx_pending_registration') || '{}');
      // #region agent log
      fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'76c51b'},body:JSON.stringify({sessionId:'76c51b',location:'RegisterPage.tsx:handleGoogle',message:'calling completeRegistration',data:{account_type:pending.account_type,hasInvite:!!pending.invite_token},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      const profile = await completeRegistration(pending);
      sessionStorage.removeItem('civx_pending_registration');
      navigate(redirectPathForRole(profile.role));
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
      <div className="flex min-h-[calc(100vh-44px)] items-center justify-center px-4 py-12 md:px-6 md:py-16">
        <div className="auth-card-wide">
          <p className="eyebrow mb-0">Create account</p>
          <h1 className="mt-2 text-[32px] font-semibold tracking-tight text-ink md:text-[36px]">Join CiVX</h1>

          <div className="register-steps">
            {steps.map((s, i) => (
              <div key={s} className="register-step">
                <div className={`register-step-bar ${i <= stepIndex ? 'register-step-bar-active' : ''}`} />
                <span className={`register-step-label ${i === stepIndex ? 'register-step-label-active' : ''}`}>
                  {STEP_LABELS[s]}
                </span>
              </div>
            ))}
          </div>

          {step === 'type' && (
            <div className="space-y-4">
              <p className="text-sm text-ink-muted-80">Choose how you will use the platform.</p>

              {ACCOUNT_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => selectType(opt.type)}
                  className="account-type-card group"
                >
                  <div className={`account-type-icon ${opt.iconClass}`}>{opt.icon}</div>
                  <p className="font-semibold text-ink">{ACCOUNT_TYPE_LABELS[opt.type]}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted-48">{opt.description}</p>
                </button>
              ))}

              <div className="account-type-card-worker">
                <div className="flex items-start gap-3">
                  <div className="account-type-icon account-type-icon-worker shrink-0">🧹</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{ACCOUNT_TYPE_LABELS.street_sweeper}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-muted-48">
                      Verified LGU workers only. Scan the QR from your supervisor, upload a photo of it, or paste the
                      invite link.
                    </p>
                  </div>
                </div>

                <InviteQrCapture
                  value={inviteToken}
                  onChange={(token) => {
                    setInviteToken(token);
                    setError('');
                    if (token) setAccountType('street_sweeper');
                  }}
                />

                {inviteInfo?.valid && (
                  <div className="mt-3 rounded-[14px] bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    Valid invite{inviteInfo.label ? `: ${inviteInfo.label}` : ''}
                    {inviteInfo.expires_at && (
                      <span className="block text-emerald-700/80">
                        Expires {new Date(inviteInfo.expires_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}

                <ButtonPrimary
                  type="button"
                  className="mt-4 w-full justify-center"
                  disabled={!inviteToken}
                  onClick={() => selectType('street_sweeper')}
                >
                  Continue as Public Worker
                </ButtonPrimary>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          )}

          {step === 'details' && accountType && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (accountType === 'street_sweeper' && !publicWorkerType) {
                  setError('Select what type of public worker you are.');
                  return;
                }
                setError('');
                setStep('credentials');
              }}
            >
              <div className="rounded-[14px] border border-hairline bg-canvas-parchment px-4 py-3 text-sm">
                Registering as <strong className="text-ink">{ACCOUNT_TYPE_LABELS[accountType]}</strong>
              </div>

              {accountType === 'street_sweeper' && inviteInfo && (
                <div
                  className={`rounded-[14px] p-3 text-sm ${inviteInfo.valid ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}
                >
                  {inviteInfo.valid
                    ? `Valid worker invite${inviteInfo.label ? `: ${inviteInfo.label}` : ''}.`
                    : `Invite is ${inviteInfo.status || 'invalid'}. Ask your LGU for a new QR code.`}
                </div>
              )}

              <input className="auth-input" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              <input className="auth-input" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              <input className="auth-input" placeholder="Barangay" value={barangay} onChange={(e) => setBarangay(e.target.value)} required />
              {accountType === 'organizer' && (
                <input
                  className="auth-input"
                  placeholder="Organization / NGO name"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  required
                />
              )}
              {accountType === 'street_sweeper' && (
                <WorkerTypeSelect
                  value={publicWorkerType}
                  onChange={setPublicWorkerType}
                  required
                />
              )}
              <div className="flex gap-3 pt-2">
                <ButtonDark type="button" className="flex-1 justify-center" onClick={() => setStep('type')}>
                  Back
                </ButtonDark>
                <ButtonPrimary type="submit" className="flex-1 justify-center">
                  Next
                </ButtonPrimary>
              </div>
            </form>
          )}

          {step === 'credentials' && accountType && (
            <form className="space-y-4" onSubmit={handleCredentials}>
              <input className="auth-input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <input
                className="auth-input"
                type="password"
                placeholder="Password (min. 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <button type="button" onClick={handleGoogle} disabled={loading} className="btn-google w-full">
                Continue with Google
              </button>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 pt-2">
                <ButtonDark type="button" className="flex-1 justify-center" onClick={() => setStep('details')}>
                  Back
                </ButtonDark>
                <ButtonPrimary type="submit" className="flex-1 justify-center" disabled={loading}>
                  {loading ? 'Creating…' : 'Create account'}
                </ButtonPrimary>
              </div>
            </form>
          )}

          <p className="mt-8 text-center text-sm text-ink-muted-48">
            Already have an account? <Link to="/login" className="font-medium text-primary">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
