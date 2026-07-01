import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GlobalNav } from '../components/ui/GlobalNav';
import { ButtonPrimary } from '../components/ui/Buttons';
import { InviteQrCapture } from '../components/auth/InviteQrCapture';
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
  const [inviteToken, setInviteToken] = useState(inviteFromUrl);
  const [inviteInfo, setInviteInfo] = useState<InviteValidation | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [barangay, setBarangay] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [publicWorkerType, setPublicWorkerType] = useState<PublicWorkerType | ''>('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, ready: authReady } = useAuth();
  const { profile, ready: profileReady } = useProfile();

  useEffect(() => {
    if (!authReady) return;
    if (!user) navigate('/login', { replace: true });
  }, [authReady, user, navigate]);

  useEffect(() => {
    if (profileReady && profile && isRegistrationComplete(profile)) {
      navigate(redirectPathForRole(profile.role), { replace: true });
    }
  }, [profile, profileReady, navigate]);

  useEffect(() => {
    const pending = sessionStorage.getItem('civx_pending_registration');
    if (pending) {
      try {
        const data = JSON.parse(pending);
        setAccountType(data.account_type ?? null);
        setFullName(data.full_name ?? '');
        setPhone(data.phone_number ?? '');
        setBarangay(data.barangay ?? '');
        setOrganizationName(data.organization_name ?? '');
        setInviteToken(data.invite_token ?? inviteFromUrl);
        setPublicWorkerType(data.public_worker_type ?? '');
      } catch {
        /* ignore */
      }
    }
  }, [inviteFromUrl]);

  useEffect(() => {
    if (!inviteToken || accountType !== 'street_sweeper') return;
    api<InviteValidation>(`/api/registration-invites/validate?token=${encodeURIComponent(inviteToken)}`)
      .then((info) => {
        setInviteInfo(info);
        if (info.barangay) setBarangay(info.barangay);
      })
      .catch(() => setInviteInfo({ valid: false, status: 'invalid' }));
  }, [inviteToken, accountType]);

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
    setLoading(true);
    setError('');
    try {
      const result = await completeRegistration({
        account_type: accountType,
        full_name: fullName,
        phone_number: phone,
        barangay,
        organization_name: accountType === 'organizer' ? organizationName : undefined,
        invite_token: accountType === 'street_sweeper' ? inviteToken : undefined,
        public_worker_type: accountType === 'street_sweeper' ? publicWorkerType || undefined : undefined,
      });
      sessionStorage.removeItem('civx_pending_registration');
      navigate(redirectPathForRole(result.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
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
              <div className="space-y-2">
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
                {inviteFromUrl && (
                  <button
                    type="button"
                    onClick={() => setAccountType('street_sweeper')}
                    className="w-full rounded-[14px] border border-primary bg-canvas-parchment p-3 text-left"
                  >
                    {ACCOUNT_TYPE_LABELS.street_sweeper}
                  </button>
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
                  <input
                    className="auth-input"
                    placeholder="Organization name"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    required
                  />
                )}
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
