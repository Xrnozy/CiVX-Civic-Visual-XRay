import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useProfile } from '../../hooks/useProfile';
import { ButtonPrimary } from '../../components/ui/Buttons';
import type { UserSummary } from '../../types/user';
import { LGU_ASSIGNABLE_ROLE_LABELS } from '../../types/user';

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function RoleBadge({ role }: { role: string }) {
  const label = LGU_ASSIGNABLE_ROLE_LABELS[role] || role;
  const className =
    role === 'lgu_admin'
      ? 'staff-role-badge staff-role-badge-admin'
      : role === 'lgu_staff'
        ? 'staff-role-badge staff-role-badge-staff'
        : role === 'field_worker'
          ? 'staff-role-badge staff-role-badge-field'
          : role === 'field_checker'
            ? 'staff-role-badge staff-role-badge-checker'
            : 'staff-role-badge staff-role-badge-other';
  return <span className={className}>{label}</span>;
}

export default function LGUStaffPage() {
  const { profile, ready } = useProfile();
  const [team, setTeam] = useState<UserSummary[]>([]);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState<UserSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadTeam = useCallback(() => {
    api<UserSummary[]>('/api/users/lgu-team').then(setTeam).catch(() => setTeam([]));
  }, []);

  useEffect(() => {
    if (profile?.role === 'lgu_admin') loadTeam();
  }, [profile, loadTeam]);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setSearching(true);
    setError('');
    setSuccess('');
    setSearchResults([]);
    try {
      const rows = await api<UserSummary[]>(
        `/api/users/lookup?email=${encodeURIComponent(searchEmail.trim())}`,
      );
      setSearchResults(rows);
      if (rows.length === 0) setError('No users found. They must register at CiVX first.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  async function setRole(userId: string, role: string) {
    setUpdatingId(userId);
    setError('');
    setSuccess('');
    try {
      await api(`/api/users/${userId}/role`, {
        method: 'POST',
        body: JSON.stringify({ role }),
      });
      setSuccess('Role updated. Ask them to sign out and sign back in.');
      loadTeam();
      setSearchResults((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update role');
    } finally {
      setUpdatingId(null);
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-ink-muted-48">
        Loading…
      </div>
    );
  }

  if (!profile || profile.role !== 'lgu_admin') {
    return <Navigate to="/lgu" replace />;
  }

  return (
    <div className="min-h-screen bg-canvas">
      <div className="staff-page-header">
        <div className="page-content !py-0">
          <p className="eyebrow mb-0">LGU Administration</p>
          <h1 className="mt-2 text-[34px] font-semibold tracking-tight text-ink md:text-[40px]">
            Staff access
          </h1>
          <p className="mt-3 max-w-2xl text-ink-muted-80">
            Promote registered users to LGU staff without touching the database. They sign up as a community member
            first — then you grant access here.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <div className="stat-card min-w-[140px] flex-1">
              <p className="stat-card-label">Team members</p>
              <p className="stat-card-value">{team.length}</p>
            </div>
            <div className="stat-card min-w-[140px] flex-1">
              <p className="stat-card-label">Admins</p>
              <p className="stat-card-value">{team.filter((u) => u.role === 'lgu_admin').length}</p>
            </div>
            <div className="stat-card min-w-[140px] flex-1">
              <p className="stat-card-label">Field workers</p>
              <p className="stat-card-value">{team.filter((u) => u.role === 'field_worker').length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="page-content">
        <div className="grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="staff-search-card">
              <h2 className="text-lg font-semibold text-ink">Add staff member</h2>
              <p className="mt-2 text-sm text-ink-muted-48">
                Search by the email they used when registering.
              </p>
              <form onSubmit={handleSearch} className="mt-5 space-y-3">
                <input
                  className="auth-input"
                  type="email"
                  placeholder="juan@barangay.gov.ph"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  required
                  minLength={3}
                />
                <ButtonPrimary type="submit" disabled={searching} className="w-full justify-center">
                  {searching ? 'Searching…' : 'Find user'}
                </ButtonPrimary>
              </form>
            </div>

            {error && (
              <div className="mt-4 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            {success && (
              <div className="mt-4 rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {success}
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted-48">Results</h3>
                {searchResults.map((user) => (
                  <UserRoleRow
                    key={user.id}
                    user={user}
                    currentUserId={profile.id}
                    updating={updatingId === user.id}
                    onSetRole={setRole}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">Current LGU team</h2>
              <span className="text-sm text-ink-muted-48">{team.length} members</span>
            </div>
            <div className="staff-team-card">
              {team.map((user) => (
                <div key={user.id} className="staff-team-row">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="staff-user-avatar">{initials(user.full_name)}</div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{user.full_name}</p>
                      <p className="truncate text-sm text-ink-muted-48">{user.email || '—'}</p>
                      {user.barangay && (
                        <p className="text-xs text-ink-muted-48">{user.barangay}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 md:justify-end">
                    <RoleBadge role={user.role} />
                    {user.id === profile.id ? (
                      <span className="text-sm text-ink-muted-48">You</span>
                    ) : (
                      <RoleSelect
                        value={user.role}
                        disabled={updatingId === user.id}
                        onChange={(role) => setRole(user.id, role)}
                      />
                    )}
                  </div>
                </div>
              ))}
              {team.length === 0 && (
                <p className="p-8 text-center text-sm text-ink-muted-48">
                  No LGU team members yet. Search for a user to add your first staff member.
                </p>
              )}
            </div>

            <p className="mt-6 text-sm text-ink-muted-48">
              After promoting someone, ask them to <strong className="text-ink-muted-80">sign out and sign back in</strong>{' '}
              so the LGU menu appears.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserRoleRow({
  user,
  currentUserId,
  updating,
  onSetRole,
}: {
  user: UserSummary;
  currentUserId: string;
  updating: boolean;
  onSetRole: (userId: string, role: string) => void;
}) {
  return (
    <div className="rounded-[18px] border border-hairline bg-canvas p-4">
      <div className="flex items-start gap-3">
        <div className="staff-user-avatar">{initials(user.full_name)}</div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{user.full_name}</p>
          <p className="truncate text-sm text-ink-muted-48">{user.email}</p>
          <div className="mt-2">
            <RoleBadge role={user.role} />
          </div>
        </div>
      </div>
      {user.id === currentUserId ? (
        <p className="mt-3 text-sm text-ink-muted-48">This is your account</p>
      ) : (
        <div className="mt-3">
          <RoleSelect
            value={user.role}
            disabled={updating}
            onChange={(role) => onSetRole(user.id, role)}
          />
        </div>
      )}
    </div>
  );
}

function RoleSelect({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (role: string) => void;
}) {
  const roles = Object.entries(LGU_ASSIGNABLE_ROLE_LABELS);
  const selectValue = roles.some(([role]) => role === value) ? value : 'lgu_staff';

  return (
    <div className="flex flex-col gap-1">
      {!roles.some(([role]) => role === value) && (
        <span className="text-xs text-ink-muted-48">Currently: {value}</span>
      )}
      <select
        className="staff-select w-full md:min-w-[200px]"
        value={selectValue}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {roles.map(([role, label]) => (
          <option key={role} value={role}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
