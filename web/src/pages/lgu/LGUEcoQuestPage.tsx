import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ButtonPrimary, ButtonSecondaryPill } from '../../components/ui/Buttons';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';
import { DEFAULT_MAP_CENTER, ECOQUEST_TASK_TYPES } from '../../shared/constants';

interface RequiredProof {
  gps?: boolean;
  before_photo?: boolean;
  after_photo?: boolean;
  qr?: boolean;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  task_type: string;
  status: string;
  barangay?: string;
  latitude?: number;
  longitude?: number;
  reward_type?: string;
  required_proof?: RequiredProof;
  qr_code_token?: string;
  created_at: string;
}

interface SubmissionUser {
  id: string;
  full_name: string;
  email?: string;
  barangay?: string;
}

interface Submission {
  id: string;
  task_id: string;
  user_id: string;
  before_photo_url?: string;
  after_photo_url?: string;
  latitude?: number;
  longitude?: number;
  verification_status: string;
  verification_notes?: string;
  reward_eligible?: boolean;
  created_at: string;
  ecoquest_tasks?: Task;
  users?: SubmissionUser;
}

const TASK_TYPE_LABELS: Record<string, string> = {
  clean_sidewalk: 'Clean sidewalk',
  collect_trash: 'Collect trash in assigned area',
  clean_canal: 'Clean canal area',
  plant_trees: 'Plant trees',
  remove_posters: 'Remove posters',
  report_illegal_dumping: 'Report verified illegal dumping',
  assist_cleanup_drive: 'Assist in cleanup drives',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-50 text-primary',
  in_progress: 'bg-amber-50 text-amber-700',
  pending_review: 'bg-orange-50 text-orange-700',
  approved: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
  closed: 'bg-gray-100 text-ink-muted-48',
  manual_review: 'bg-orange-50 text-orange-700',
};

function formatLabel(value: string) {
  return TASK_TYPE_LABELS[value] || value.replace(/_/g, ' ');
}

function ProofBadges({ proof }: { proof?: RequiredProof }) {
  const items = [
    { key: 'gps', label: 'GPS' },
    { key: 'before_photo', label: 'Before photo' },
    { key: 'after_photo', label: 'After photo' },
    { key: 'qr', label: 'QR' },
  ] as const;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map(({ key, label }) =>
        proof?.[key] ? (
          <span key={key} className="rounded-full bg-canvas-parchment px-2 py-0.5 text-xs text-ink-muted-48">
            {label}
          </span>
        ) : null,
      )}
    </div>
  );
}

function parseApiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : 'Failed to publish task';
  if (raw.includes('401') || raw.toLowerCase().includes('missing auth') || raw.toLowerCase().includes('invalid token')) {
    return 'You must be signed in with an LGU account. Go to Sign In, then try again. If you are signed in, restart the backend and confirm Firebase credentials in infra/.env.';
  }
  if (raw.includes('403') || raw.toLowerCase().includes('insufficient permissions')) {
    return 'Your account does not have LGU permissions (lgu_admin or lgu_staff). Ask an admin to update your role.';
  }
  return raw.length > 200 ? 'Could not publish task. Check that the backend is running and you are signed in.' : raw;
}

export default function LGUEcoQuestPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState<'tasks' | 'review'>('tasks');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    task_type: ECOQUEST_TASK_TYPES[0],
    barangay: '',
    latitude: DEFAULT_MAP_CENTER.lat,
    longitude: DEFAULT_MAP_CENTER.lng,
    reward_type: '',
    requireGps: true,
    requireBefore: true,
    requireAfter: true,
    requireQr: true,
  });

  const loadTasks = useCallback(() => {
    api<Task[]>('/api/ecoquest/tasks').then(setTasks).catch(() => setTasks([]));
  }, []);

  const loadSubmissions = useCallback(() => {
    api<Submission[]>('/api/ecoquest/submissions').then(setSubmissions).catch(() => setSubmissions([]));
  }, []);

  const load = useCallback(() => {
    loadTasks();
    loadSubmissions();
  }, [loadTasks, loadSubmissions]);

  useEffect(() => { load(); }, [load]);

  const reviewQueue = submissions.filter((s) =>
    ['manual_review', 'pending'].includes(s.verification_status),
  );

  async function createTask(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      setFormError('You must sign in before publishing a task.');
      return;
    }
    setCreating(true);
    setFormError('');
    try {
      await api('/api/ecoquest/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          task_type: form.task_type,
          barangay: form.barangay || null,
          latitude: form.latitude,
          longitude: form.longitude,
          reward_type: form.reward_type || null,
          required_proof: {
            gps: form.requireGps,
            before_photo: form.requireBefore,
            after_photo: form.requireAfter,
            qr: form.requireQr,
          },
        }),
      });
      setForm((f) => ({ ...f, title: '', description: '', barangay: '', reward_type: '' }));
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(parseApiError(err));
    } finally {
      setCreating(false);
    }
  }

  async function approveSubmission(id: string) {
    await api(`/api/ecoquest/submissions/${id}/approve`, { method: 'POST' });
    load();
  }

  async function rejectSubmission(id: string) {
    await api(`/api/ecoquest/submissions/${id}/reject`, { method: 'POST' });
    load();
  }

  async function closeTask(id: string) {
    await api(`/api/ecoquest/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'closed' }),
    });
    load();
  }

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">Community Micro-Tasks</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[34px] font-semibold">EcoQuest</h1>
          <p className="mt-1 max-w-2xl text-ink-muted-80">
            Create LGU-sponsored public service tasks and verify citizen submissions using GPS, before/after photos, and QR validation.
          </p>
        </div>
        <ButtonPrimary onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : 'Create Task'}
        </ButtonPrimary>
      </div>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => setTab('tasks')}
          className={`rounded-full px-4 py-1.5 text-sm ${tab === 'tasks' ? 'bg-primary text-white' : 'bg-canvas-parchment text-ink-muted-48'}`}
        >
          Tasks ({tasks.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('review')}
          className={`rounded-full px-4 py-1.5 text-sm ${tab === 'review' ? 'bg-primary text-white' : 'bg-canvas-parchment text-ink-muted-48'}`}
        >
          Review Queue ({reviewQueue.length})
        </button>
      </div>

      {showForm && (
        <form onSubmit={createTask} className="store-utility-card mt-6 space-y-4">
          <h2 className="font-semibold">New EcoQuest Task</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              Title
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full rounded-lg border border-hairline px-3 py-2"
                placeholder="e.g. Clean sidewalk near Barangay Hall"
              />
            </label>
            <label className="block text-sm">
              Task type
              <select
                value={form.task_type}
                onChange={(e) => setForm({ ...form, task_type: e.target.value })}
                className="mt-1 w-full rounded-lg border border-hairline px-3 py-2"
              >
                {ECOQUEST_TASK_TYPES.map((t) => (
                  <option key={t} value={t}>{formatLabel(t)}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm md:col-span-2">
              Description
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-1 w-full rounded-lg border border-hairline px-3 py-2"
                rows={2}
                placeholder="Instructions for volunteers"
              />
            </label>
            <label className="block text-sm">
              Barangay
              <input
                value={form.barangay}
                onChange={(e) => setForm({ ...form, barangay: e.target.value })}
                className="mt-1 w-full rounded-lg border border-hairline px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Reward type (optional)
              <input
                value={form.reward_type}
                onChange={(e) => setForm({ ...form, reward_type: e.target.value })}
                className="mt-1 w-full rounded-lg border border-hairline px-3 py-2"
                placeholder="e.g. service_hours, certificate"
              />
            </label>
            <label className="block text-sm">
              Latitude
              <input
                type="number"
                step="any"
                value={form.latitude}
                onChange={(e) => setForm({ ...form, latitude: parseFloat(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-hairline px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Longitude
              <input
                type="number"
                step="any"
                value={form.longitude}
                onChange={(e) => setForm({ ...form, longitude: parseFloat(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-hairline px-3 py-2"
              />
            </label>
          </div>
          <fieldset>
            <legend className="text-sm font-medium">Required proof</legend>
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              {([
                ['requireGps', 'GPS check-in'],
                ['requireBefore', 'Before photo'],
                ['requireAfter', 'After photo'],
                ['requireQr', 'QR validation'],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          {formError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
          )}
          <ButtonPrimary type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'Publish Task'}
          </ButtonPrimary>
        </form>
      )}

      {tab === 'tasks' && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {tasks.length === 0 && (
            <p className="text-sm text-ink-muted-48 md:col-span-2">No EcoQuest tasks yet. Create one to get started.</p>
          )}
          {tasks.map((t) => (
            <div key={t.id} className="store-utility-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{t.title}</p>
                  <p className="text-sm text-ink-muted-48">{formatLabel(t.task_type)}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[t.status] || 'bg-gray-100'}`}>
                  {t.status.replace(/_/g, ' ')}
                </span>
              </div>
              {t.description && <p className="mt-2 text-sm text-ink-muted-80">{t.description}</p>}
              <p className="mt-2 text-sm text-ink-muted-48">
                {[t.barangay, t.reward_type && `Reward: ${t.reward_type}`].filter(Boolean).join(' · ')}
              </p>
              {t.latitude != null && t.longitude != null && (
                <p className="mt-1 text-xs text-ink-muted-48">
                  GPS: {t.latitude.toFixed(5)}, {t.longitude.toFixed(5)}
                </p>
              )}
              <ProofBadges proof={t.required_proof} />
              {t.qr_code_token && (
                <p className="mt-3 rounded-lg bg-canvas-parchment px-3 py-2 font-mono text-xs text-ink-muted-48">
                  QR: {t.qr_code_token.slice(0, 8)}…
                </p>
              )}
              {t.status !== 'closed' && (
                <div className="mt-4">
                  <ButtonSecondaryPill onClick={() => closeTask(t.id)}>Close Task</ButtonSecondaryPill>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'review' && (
        <div className="mt-6 space-y-4">
          {reviewQueue.length === 0 && (
            <p className="text-sm text-ink-muted-48">No submissions awaiting LGU review.</p>
          )}
          {reviewQueue.map((s) => {
            const task = s.ecoquest_tasks;
            return (
              <div key={s.id} className="store-utility-card">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">{task?.title || 'Unknown task'}</p>
                    <p className="text-sm text-ink-muted-48">
                      {s.users?.full_name || 'Volunteer'} · {s.users?.barangay || '—'} · {new Date(s.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[s.verification_status] || 'bg-gray-100'}`}>
                    {s.verification_status.replace(/_/g, ' ')}
                  </span>
                </div>

                {s.verification_notes && (
                  <p className="mt-3 rounded-lg bg-canvas-parchment px-3 py-2 text-sm text-ink-muted-80">
                    Agent notes: {s.verification_notes}
                  </p>
                )}

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted-48">Before</p>
                    {s.before_photo_url ? (
                      <img src={s.before_photo_url} alt="Before" className="w-full rounded-lg border border-hairline object-cover" />
                    ) : (
                      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-hairline text-sm text-ink-muted-48">
                        Missing
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted-48">After</p>
                    {s.after_photo_url ? (
                      <img src={s.after_photo_url} alt="After" className="w-full rounded-lg border border-hairline object-cover" />
                    ) : (
                      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-hairline text-sm text-ink-muted-48">
                        Missing
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-4 text-sm text-ink-muted-48">
                  <span>
                    GPS: {s.latitude != null && s.longitude != null
                      ? `${s.latitude.toFixed(5)}, ${s.longitude.toFixed(5)}`
                      : 'Not provided'}
                  </span>
                  {task?.qr_code_token && <span>QR token issued</span>}
                </div>

                <div className="mt-4 flex gap-2">
                  <ButtonPrimary onClick={() => approveSubmission(s.id)}>Approve</ButtonPrimary>
                  <ButtonSecondaryPill onClick={() => rejectSubmission(s.id)}>Reject</ButtonSecondaryPill>
                </div>
              </div>
            );
          })}

          {submissions.filter((s) => !['manual_review', 'pending'].includes(s.verification_status)).length > 0 && (
            <div className="mt-10">
              <h2 className="text-lg font-semibold">Recent Decisions</h2>
              <div className="mt-4 space-y-3">
                {submissions
                  .filter((s) => !['manual_review', 'pending'].includes(s.verification_status))
                  .slice(0, 10)
                  .map((s) => (
                    <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-hairline px-4 py-3 text-sm">
                      <span>{s.ecoquest_tasks?.title || s.task_id.slice(0, 8)} — {s.users?.full_name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_COLORS[s.verification_status] || ''}`}>
                        {s.verification_status}
                        {s.reward_eligible ? ' · reward eligible' : ''}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
