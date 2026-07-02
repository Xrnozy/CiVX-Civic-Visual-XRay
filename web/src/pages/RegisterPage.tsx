import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { GlobalNav } from '../components/ui/GlobalNav';
import { ButtonDark, ButtonPrimary } from '../components/ui/Buttons';
import { InviteQrCapture } from '../components/auth/InviteQrCapture';
import { ProfileImageUpload, uploadProfileImage } from '../components/auth/ProfileImageUpload';
import { WorkerTypeSelect } from '../components/auth/WorkerTypeSelect';
import { isFirebaseConfigured } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import {
  authErrorMessage,
  completeRegistration,
  fetchProfileAfterAuth,
  GoogleRedirectStartedError,
  isRegistrationComplete,
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
  const sessionFromUrl = searchParams.get('session') ?? '';
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
  const [organizationLogoUrl, setOrganizationLogoUrl] = useState('');
  const [organizationLogoFile, setOrganizationLogoFile] = useState<File | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [publicWorkerType, setPublicWorkerType] = useState<PublicWorkerType | ''>('');
  const [workerFlowOpen, setWorkerFlowOpen] = useState(Boolean(inviteFromUrl));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, ready } = useAuth();
  const { profile, ready: profileReady } = useProfile();

  const steps: Step[] = ['type', 'details', 'credentials'];
  const stepIndex = steps.indexOf(step);

  useEffect(() => {
    if (!ready || !user || !profileReady || loading) return;
    if (sessionStorage.getItem('civx_pending_registration')) return;
    if (step !== 'type') return;
    if (profile && !isRegistrationComplete(profile)) {
      navigate('/register/complete', { replace: true });
    }
  }, [ready, user, profile, profileReady, loading, step, navigate]);

  useEffect(() => {
    if (sessionFromUrl) {
      sessionStorage.setItem('civx_demo_session_token', sessionFromUrl);
    }
  }, [sessionFromUrl]);

  useEffect(() => {
    if (!inviteToken) return;
    api<InviteValidation>(`/api/registration-invites/validate?token=${encodeURIComponent(inviteToken)}`)
      .then((info) => {
        setInviteInfo(info);
        if (info.barangay) setBarangay(info.barangay);
      })
      .catch(() => setInviteInfo({ valid: false, status: 'invalid' }));
  }, [inviteToken]);

  function selectType(type: AccountType) {
    setAccountType(type);
    setError('');
    if (type === 'street_sweeper' && !inviteToken) {
      setError('Scan or upload your LGU worker QR code first.');
      return;
    }
    setStep('details');
  }

  function buildPendingPayload(overrides?: { organization_logo_url?: string; profile_photo_url?: string }) {
    return {
      account_type: accountType,
      full_name: fullName,
      phone_number: phone,
      barangay,
      organization_name: organizationName,
      organization_logo_url: overrides?.organization_logo_url ?? organizationLogoUrl,
      profile_photo_url: overrides?.profile_photo_url ?? profilePhotoUrl,
      invite_token: inviteToken,
      public_worker_type: publicWorkerType,
    };
  }

  async function resolveMediaUrls() {
    let logoUrl = organizationLogoUrl.startsWith('blob:') ? '' : organizationLogoUrl;
    let photoUrl = profilePhotoUrl.startsWith('blob:') ? '' : profilePhotoUrl;
    if (organizationLogoFile) logoUrl = await uploadProfileImage(organizationLogoFile);
    if (profilePhotoFile) photoUrl = await uploadProfileImage(profilePhotoFile);
    if (logoUrl.startsWith('blob:')) logoUrl = '';
    if (photoUrl.startsWith('blob:')) photoUrl = '';
    setOrganizationLogoUrl(logoUrl);
    setProfilePhotoUrl(photoUrl);
    return { logoUrl, photoUrl };
  }

  function storePendingRegistration() {
    if (!accountType) return;
    sessionStorage.setItem('civx_pending_registration', JSON.stringify(buildPendingPayload()));
  }

  async function handleCredentials(e: FormEvent) {
    e.preventDefault();
    if (!accountType || !isFirebaseConfigured) return;
    if (accountType === 'organizer' && !organizationLogoUrl && !organizationLogoFile) {
      setError('Upload your community organization logo.');
      return;
    }
    if (accountType === 'street_sweeper' && inviteInfo && !inviteInfo.valid) {
      setError('Worker invite is invalid or expired.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const cred = await registerWithEmail(email, password, fullName);
      await persistAuthSession(cred);
      const { logoUrl, photoUrl } = await resolveMediaUrls();
      const profile = await completeRegistration({
        account_type: accountType,
        full_name: fullName,
        phone_number: phone,
        barangay,
        organization_name: accountType === 'organizer' ? organizationName : undefined,
        organization_logo_url: accountType === 'organizer' ? logoUrl : undefined,
        profile_photo_url: photoUrl || undefined,
        invite_token: accountType === 'street_sweeper' ? inviteToken : undefined,
        public_worker_type: accountType === 'street_sweeper' ? publicWorkerType || undefined : undefined,
      });
      sessionStorage.removeItem('civx_pending_registration');
      const nextAfterRegister = searchParams.get('next');
      navigate(nextAfterRegister || redirectPathForRole(profile.role));
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
    if (accountType === 'organizer' && !organizationLogoUrl && !organizationLogoFile) {
      setError('Upload your community organization logo before continuing.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const cred = await signInWithGoogle();
      await persistAuthSession(cred);
      const { logoUrl, photoUrl } = await resolveMediaUrls();
      sessionStorage.setItem(
        'civx_pending_registration',
        JSON.stringify(buildPendingPayload({ organization_logo_url: logoUrl, profile_photo_url: photoUrl })),
      );
      const profile = await fetchProfileAfterAuth();
      if (isRegistrationComplete(profile)) {
        sessionStorage.removeItem('civx_pending_registration');
        navigate(searchParams.get('next') || redirectPathForRole(profile.role));
        return;
      }
      navigate('/register/complete');
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
                <button
                  type="button"
                  className="account-type-card group w-full text-left"
                  onClick={() => {
                    setWorkerFlowOpen(true);
                    setError('');
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="account-type-icon account-type-icon-worker shrink-0">🧹</div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">{ACCOUNT_TYPE_LABELS.street_sweeper}</p>
                      <p className="mt-1 text-sm leading-relaxed text-ink-muted-48">
                        Verified LGU workers only. You will scan or enter your supervisor&apos;s invite QR after selecting this option.
                      </p>
                    </div>
                  </div>
                </button>

                {workerFlowOpen && (
                  <>
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
                  </>
                )}
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
                if (accountType === 'organizer' && !organizationLogoUrl && !organizationLogoFile) {
                  setError('Upload your community organization logo.');
                  return;
                }
                setError('');
                storePendingRegistration();
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
                <>
                  <input
                    className="auth-input"
                    placeholder="Organization / NGO name"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    required
                  />
                  <ProfileImageUpload
                    label="Community organization logo"
                    hint="Shown on cleanup events you organize."
                    value={organizationLogoUrl}
                    onChange={setOrganizationLogoUrl}
                    onFileSelect={(file, preview) => {
                      setOrganizationLogoFile(file);
                      setOrganizationLogoUrl(preview);
                    }}
                    authenticated={false}
                    required
                  />
                </>
              )}
              <ProfileImageUpload
                label="Profile photo"
                hint="Optional — helps volunteers recognize you."
                value={profilePhotoUrl}
                onChange={setProfilePhotoUrl}
                onFileSelect={(file, preview) => {
                  setProfilePhotoFile(file);
                  setProfilePhotoUrl(preview);
                }}
                authenticated={false}
              />
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
