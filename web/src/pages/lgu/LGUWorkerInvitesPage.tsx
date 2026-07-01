import { FormEvent, useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../../lib/api';
import { ButtonPrimary } from '../../components/ui/Buttons';
import type { RegistrationInvite } from '../../types/user';

export default function LGUWorkerInvitesPage() {
  const [invites, setInvites] = useState<RegistrationInvite[]>([]);
  const [label, setLabel] = useState('');
  const [barangay, setBarangay] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [creating, setCreating] = useState(false);
  const [latestQr, setLatestQr] = useState<{ url: string; dataUrl: string } | null>(null);

  const load = useCallback(() => {
    api<RegistrationInvite[]>('/api/registration-invites').then(setInvites).catch(() => setInvites([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createInvite(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const row = await api<RegistrationInvite>('/api/registration-invites', {
        method: 'POST',
        body: JSON.stringify({ label, barangay, expires_in_days: expiresInDays }),
      });
      const registerUrl = row.register_url || `${window.location.origin}/register?invite=${row.token}`;
      const dataUrl = await QRCode.toDataURL(registerUrl, { width: 280, margin: 2 });
      setLatestQr({ url: registerUrl, dataUrl });
      setLabel('');
      load();
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    await api(`/api/registration-invites/${id}/revoke`, { method: 'POST' });
    load();
  }

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <h1 className="text-[34px] font-semibold text-ink">Public Workers invites</h1>
      <p className="mt-2 text-ink-muted-80">
        Generate QR codes for verified workers. Invites expire after the set period and can only be used once.
      </p>

      <form onSubmit={createInvite} className="store-utility-card mt-8 grid gap-4 md:grid-cols-4">
        <input className="auth-input" placeholder="Label (e.g. Brgy 5 batch)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input className="auth-input" placeholder="Barangay" value={barangay} onChange={(e) => setBarangay(e.target.value)} />
        <select className="auth-input" value={expiresInDays} onChange={(e) => setExpiresInDays(Number(e.target.value))}>
          <option value={1}>Expires in 1 day</option>
          <option value={7}>Expires in 7 days</option>
          <option value={30}>Expires in 30 days</option>
        </select>
        <ButtonPrimary type="submit" disabled={creating} className="justify-center">
          {creating ? 'Creating…' : 'Generate QR invite'}
        </ButtonPrimary>
      </form>

      {latestQr && (
        <div className="store-utility-card mt-8 flex flex-col items-center gap-4 md:flex-row">
          <img src={latestQr.dataUrl} alt="Worker registration QR code" className="rounded-xl border border-hairline" />
          <div className="text-sm text-ink-muted-80">
            <p className="font-semibold text-ink">Share this QR with your public worker</p>
            <p className="mt-2 break-all">{latestQr.url}</p>
          </div>
        </div>
      )}

      <div className="mt-10 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-hairline text-ink-muted-48">
              <th className="py-2">Label</th>
              <th>Barangay</th>
              <th>Status</th>
              <th>Expires</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {invites.map((inv) => (
              <tr key={inv.id} className="border-b border-hairline">
                <td className="py-3">{inv.label || '—'}</td>
                <td>{inv.barangay || '—'}</td>
                <td className="capitalize">{inv.status}</td>
                <td>{new Date(inv.expires_at).toLocaleString()}</td>
                <td>
                  {inv.status === 'active' && (
                    <button type="button" className="text-primary" onClick={() => revoke(inv.id)}>
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
