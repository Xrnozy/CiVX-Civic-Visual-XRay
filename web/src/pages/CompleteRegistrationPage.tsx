import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GlobalNav } from '../components/ui/GlobalNav';
import { ButtonPrimary } from '../components/ui/Buttons';
import { InviteQrCapture } from '../components/auth/InviteQrCapture';
import { ProfileImageUpload } from '../components/auth/ProfileImageUpload';
import { WorkerTypeSelect } from '../components/auth/WorkerTypeSelect';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { completeRegistration, isRegistrationComplete, redirectPathForRole } from '../lib/auth';
import { api } from '../lib/api';
import type { AccountType, InviteValidation, PublicWorkerType } from '../types/user';
import { ACCOUNT_TYPE_LABELS } from '../types/user';

export default function CompleteRegistrationPage() {
  const [searchParams] = useSearchParams();
  const inviteFromUrl = searchParams.get('invite') ?? '';
  const roleHint = searchParams.get('role');
  const [accountType, setAccountType] = useState<AccountType | null>(
    roleHint === 'street_sweeper' ? 'street_sweeper' : inviteFromUrl ? 'street_sweeper' : null,
  );
  const [workerFlowOpen, setWorkerFlowOpen] = useState(Boolean(inviteFromUrl || roleHint === 'street_sweeper'));
  const [inviteToken, setInviteToken] = useState(inviteFromUrl);
  const [inviteInfo, setInviteInfo] = useState<InviteValidation | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [barangay, setBarangay] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [organizationLogoUrl, setOrganizationLogoUrl] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [publicWorkerType, setPublicWorkerType] = useState<PublicWorkerType | ''>('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const autoSubmitted = useRef(false);
  const navigate = useNavigate();
  const { user, ready: authReady } = useAuth();
  const { profile, ready: profileReady, refresh } = useProfile();

  useEffect(() => {
    if (!authReady) return;
    if (!user) navigate('/login', { replace: true });
  }, [authReady, user, navigate]);

  useEffect(() => {
    if (profileReady && profile && isRegistrationComplete(profile)) {
      sessionStorage.removeItem('civx_pending_registration');
      navigate(redirectPathForRole(profile.role), { replace: true });
    }
  }, [profile, profileReady, navigate]);

  useEffect(() => {
    const pending = sessionStorage.getItem('civx_pending_registration');
    if (!pending) return;
    try {
      const data = JSON.parse(pending);
      setAccountType(data.account_type ?? null);
      setFullName(data.full_name ?? '');
      setPhone(data.phone_number ?? '');
      setBarangay(data.barangay ?? '');
      setOrganizationName(data.organization_name ?? '');
      setOrganizationLogoUrl(data.organization_logo_url ?? '');
      setProfilePhotoUrl(data.profile_photo_url ?? '');
      setInviteToken(data.invite_token ?? inviteFromUrl);
      setPublicWorkerType(data.public_worker_type ?? '');
      if (data.account_type === 'street_sweeper') setWorkerFlowOpen(true);
    } catch {
      /* ignore */
    }
  }, [inviteFromUrl]);

  useEffect(() => {
    if (!inviteToken) return;
    api<InviteValidation>(`/api/registration-invites/validate?token=${encodeURIComponent(inviteToken)}`)
      .then((info) => {
        setInviteInfo(info);
        if (info.barangay) setBarangay(info.barangay);
      })
      .catch(() => setInviteInfo({ valid: false, status: 'invalid' }));
  }, [inviteToken]);

  async function submitRegistration(payload: {
    account_type: AccountType;
    full_name: string;
    phone_number: string;
    barangay: string;
    organization_name?: string;
    organization_logo_url?: string;
    profile_photo_url?: string;
    invite_token?: string;
    public_worker_type?: string;
  }) {
    const result = await completeRegistration(payload);
    sessionStorage.removeItem('civx_pending_registration');
    await refresh();
    navigate(redirectPathForRole(result.role));
  }

  useEffect(() => {
    if (autoSubmitted.current || !authReady || !user || !profileReady || !profile) return;
    if (isRegistrationComplete(profile)) return;
    const pendingRaw = sessionStorage.getItem('civx_pending_registration');
    if (!pendingRaw) return;
    try {
      const data = JSON.parse(pendingRaw);
      if (!data.account_type || !data.full_name?.trim() || !data.phone_number?.trim() || !data.barangay?.trim()) return;
      if (data.account_type === 'street_sweeper' && !data.public_worker_type) return;
      if (data.account_type === 'organizer' && !data.organization_logo_url) return;
      autoSubmitted.current = true;
      setLoading(true);
      void submitRegistration(data).catch((err) => {
        autoSubmitted.current = false;
        const msg = err instanceof Error ? err.message : 'Registration failed';
        if (msg.includes('Registration already completed') || msg.includes('already completed')) {
          sessionStorage.removeItem('civx_pending_registration');
          navigate(redirectPathForRole(profile.role), { replace: true });
          return;
        }
        setError(msg);
        setLoading(false);
      });
    } catch {
      autoSubmitted.current = false;
    }
  }, [authReady, user, profileReady, profile, navigate, refresh]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accountType) {
      setError('Select an account type');
      return;
    }
    if (accountType === 'street_sweeper' && !publicWorkerType) {
      setError('Select what type of public worker you are.');
      return;
    }
    if (accountType === 'organizer' && !organizationLogoUrl) {
      setError('Upload your community organization logo.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await submitRegistration({
        account_type: accountType,
        full_name: fullName,
        phone_number: phone,
        barangay,
        organization_name: accountType === 'organizer' ? organizationName : undefined,
        organization_logo_url: accountType === 'organizer' ? organizationLogoUrl : undefined,
        profile_photo_url: profilePhotoUrl || undefined,
        invite_token: accountType === 'street_sweeper' ? inviteToken : undefined,
        public_worker_type: accountType === 'street_sweeper' ? publicWorkerType || undefined : undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      if (msg.includes('already completed')) {
        navigate(redirectPathForRole(profile?.role || 'citizen'), { replace: true });
        return;
      }
      setError(msg);
      setLoading(false);
    }
  }

  if (!authReady || !user) return null;

  if (profileReady && profile && isRegistrationComplete(profile)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-canvas-parchment">
      <GlobalNav />
      <div className="flex min-h-[calc(100vh-44px)] items-center justify-center px-6 py-16">
        <div className="auth-card-wide max-w-lg">
          <h1 className="text-[32px] font-semibold text-ink">Complete your profile</h1>
          <p className="mt-2 text-sm text-ink-muted-48">Tell us how you will use CiVX.</p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            {!accountType && (
              <div className="space-y-3">
                <p className="text-sm text-ink-muted-48">Choose how you will use the platform.</p>
                {(['citizen', 'organizer'] as AccountType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setAccountType(type)}
                    className="w-full rounded-[14px] border border-hairline p-3 text-left hover:border-primary"
                  >
                    {ACCOUNT_TYPE_LABELS[type]}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setWorkerFlowOpen(true)}
                  className="w-full rounded-[14px] border border-hairline p-3 text-left hover:border-primary"
                >
                  {ACCOUNT_TYPE_LABELS.street_sweeper}
                </button>
                {workerFlowOpen && (
                  <div className="rounded-[14px] border border-hairline bg-canvas-parchment p-4">
                    <InviteQrCapture value={inviteToken} onChange={(token) => {
                      setInviteToken(token);
                      if (token) setAccountType('street_sweeper');
                    }} />
                    <ButtonPrimary
                      type="button"
                      className="mt-4 w-full justify-center"
                      disabled={!inviteToken}
                      onClick={() => setAccountType('street_sweeper')}
                    >
                      Continue as Public Worker
                    </ButtonPrimary>
                  </div>
                )}
              </div>
            )}

            {accountType && (
              <>
                <p className="text-sm text-ink-muted-48">
                  Account type: <strong>{ACCOUNT_TYPE_LABELS[accountType]}</strong>
                </p>
                {accountType === 'street_sweeper' && (
                  <InviteQrCapture value={inviteToken} onChange={setInviteToken} />
                )}
                {inviteInfo && accountType === 'street_sweeper' && (
                  <p className={`text-sm ${inviteInfo.valid ? 'text-green-700' : 'text-red-600'}`}>
                    {inviteInfo.valid ? 'Invite verified' : `Invite ${inviteInfo.status}`}
                  </p>
                )}
                <input className="auth-input" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                <input className="auth-input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                <input className="auth-input" placeholder="Barangay" value={barangay} onChange={(e) => setBarangay(e.target.value)} required />
                {accountType === 'organizer' && (
                  <>
                    <input
                      className="auth-input"
                      placeholder="Organization name"
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      required
                    />
                    <ProfileImageUpload
                      label="Community organization logo"
                      hint="Required for community leaders."
                      value={organizationLogoUrl}
                      onChange={setOrganizationLogoUrl}
                      required
                    />
                  </>
                )}
                <ProfileImageUpload
                  label="Profile photo"
                  hint="Optional"
                  value={profilePhotoUrl}
                  onChange={setProfilePhotoUrl}
                />
                {accountType === 'street_sweeper' && (
                  <WorkerTypeSelect value={publicWorkerType} onChange={setPublicWorkerType} required />
                )}
              </>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
            <ButtonPrimary type="submit" className="w-full justify-center" disabled={loading || !accountType}>
              {loading ? 'Saving…' : 'Finish registration'}
            </ButtonPrimary>
          </form>
        </div>
      </div>
    </div>
  );
}
