import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GlobalNav } from '../components/ui/GlobalNav';
import { ButtonPrimary } from '../components/ui/Buttons';
import { InviteQrCapture } from '../components/auth/InviteQrCapture';
import { ProfileImageUpload } from '../components/auth/ProfileImageUpload';
import { WorkerTypeSelect } from '../components/auth/WorkerTypeSelect';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import {
  completeRegistration,
  isRegistrationComplete,
  redirectPathForRole,
  registrationErrorMessage,
} from '../lib/auth';
import {
  clearPendingRegistration,
  finishPendingRegistration,
  isPendingRegistrationComplete,
  loadPendingRegistration,
  mergePendingRegistration,
  savePendingRegistration,
} from '../lib/pendingRegistration';
import { tryCompletePendingRegistration } from '../lib/finishRegistrationFlow';
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
  const userId = user?.uid ?? null;
  const { profile, ready: profileReady, refresh } = useProfile();

  useEffect(() => {
    if (!authReady) return;
    if (!userId) navigate('/login', { replace: true });
  }, [authReady, userId, navigate]);

  useEffect(() => {
    if (profileReady && profile && isRegistrationComplete(profile)) {
      clearPendingRegistration();
      navigate(redirectPathForRole(profile.role), { replace: true });
    }
  }, [profile, profileReady, navigate]);

  useEffect(() => {
    const pending = loadPendingRegistration();
    if (!pending) return;
    setAccountType(pending.account_type ?? null);
    setFullName(pending.full_name ?? '');
    setPhone(pending.phone_number ?? '');
    setBarangay(pending.barangay ?? '');
    setOrganizationName(pending.organization_name ?? '');
    setOrganizationLogoUrl(
      pending.organization_logo_url ?? pending.organization_logo_data_url ?? '',
    );
    setProfilePhotoUrl(pending.profile_photo_url ?? pending.profile_photo_data_url ?? '');
    setInviteToken(pending.invite_token ?? inviteFromUrl);
    setPublicWorkerType((pending.public_worker_type as PublicWorkerType) ?? '');
    if (pending.account_type === 'street_sweeper') setWorkerFlowOpen(true);
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

  async function submitRegistration(payload: Parameters<typeof completeRegistration>[0]) {
    const result = await completeRegistration(payload);
    clearPendingRegistration();
    await refresh();
    navigate(redirectPathForRole(result.role), { replace: true });
  }

  useEffect(() => {
    if (autoSubmitted.current || !authReady || !userId) return;
    if (profileReady && profile && isRegistrationComplete(profile)) return;
    const pending = loadPendingRegistration();
    if (!pending || !isPendingRegistrationComplete(pending)) return;
    autoSubmitted.current = true;
    setLoading(true);
    void tryCompletePendingRegistration(pending).then((result) => {
      if (result.completed && result.role) {
        const role = result.role;
        void refresh().then(() => navigate(redirectPathForRole(role), { replace: true }));
        return;
      }
      autoSubmitted.current = false;
      if (result.error) setError(result.error);
      setLoading(false);
    });
  }, [authReady, userId, profileReady, profile, navigate, refresh]);

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
      if (!accountType) return;
      const pending = mergePendingRegistration(loadPendingRegistration(), {
        account_type: accountType,
        full_name: fullName,
        phone_number: phone,
        barangay,
        organization_name: organizationName || undefined,
        organization_logo_url: organizationLogoUrl || undefined,
        profile_photo_url: profilePhotoUrl || undefined,
        invite_token: inviteToken || undefined,
        public_worker_type: publicWorkerType || undefined,
      });
      savePendingRegistration(pending);
      const payload = await finishPendingRegistration(pending);
      await submitRegistration(payload);
    } catch (err) {
      const msg = registrationErrorMessage(err);
      if (msg.includes('already completed')) {
        navigate(redirectPathForRole(profile?.role || 'citizen'), { replace: true });
        return;
      }
      setError(msg);
      setLoading(false);
    }
  }

  if (!authReady || !userId) return null;

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
