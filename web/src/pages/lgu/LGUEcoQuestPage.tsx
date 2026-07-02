import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ButtonPrimary, ButtonSecondaryPill } from '../../components/ui/Buttons';
import {
  PartySlotSection,
  partySlotToEntry,
  type PartySlot,
} from '../../components/ecoquest/PartySlotSection';
import {
  RequiredProofSection,
  ProofBadges,
} from '../../components/ecoquest/RequiredProofSection';
import { EcoQuestTaskQrPanel } from '../../components/ecoquest/EcoQuestTaskQrPanel';
import {
  LocationPickerSection,
  hasDetectedBarangay,
  hasValidLocation,
} from '../../components/map/LocationPickerSection';
import { fetchAddressFromCoordinates } from '../../lib/geocoding';
import { api } from '../../lib/api';
import { ECOQUEST_TASK_TYPES, formatDefaultMapCoordinates, type EcoQuestTaskType } from '../../shared/constants';

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

const DEFAULT_COORDS = formatDefaultMapCoordinates();

const EMPTY_FORM = {
  title: '',
  description: '',
  task_type: ECOQUEST_TASK_TYPES[0] as EcoQuestTaskType,
  barangay: '',
  street: '',
  city: '',
  province: '',
  latitude: DEFAULT_COORDS.latitude,
  longitude: DEFAULT_COORDS.longitude,
  reward_type: '',
  requireGps: true,
  requireBefore: true,
  requireAfter: true,
  requireQr: true,
  collaboratorSlots: [] as PartySlot[],
  sponsorSlots: [] as PartySlot[],
};

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

export default function LGUEcoQuestPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState<'tasks' | 'review'>('tasks');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [qrTask, setQrTask] = useState<Task | null>(null);

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
    // #region agent log
    fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ed5453'},body:JSON.stringify({sessionId:'ed5453',location:'LGUEcoQuestPage.tsx:createTask:entry',message:'createTask invoked',data:{titleLen:form.title.length,hasValidLoc:hasValidLocation(form.latitude,form.longitude),hasBarangay:hasDetectedBarangay(form),barangay:form.barangay?.slice(0,40),lat:form.latitude,lng:form.longitude,creating},timestamp:Date.now(),hypothesisId:'H1-H4',runId:'publish-debug'})}).catch(()=>{});
    // #endregion
    if (!hasValidLocation(form.latitude, form.longitude)) {
      setFormError('Pin the task location on the map before publishing.');
      // #region agent log
      fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ed5453'},body:JSON.stringify({sessionId:'ed5453',location:'LGUEcoQuestPage.tsx:createTask:guard-location',message:'blocked invalid location',data:{lat:form.latitude,lng:form.longitude},timestamp:Date.now(),hypothesisId:'H1',runId:'publish-debug'})}).catch(()=>{});
      // #endregion
      return;
    }
    if (!hasDetectedBarangay(form)) {
      setFormError('Wait for barangay detection to finish before publishing.');
      // #region agent log
      fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ed5453'},body:JSON.stringify({sessionId:'ed5453',location:'LGUEcoQuestPage.tsx:createTask:guard-barangay',message:'blocked missing barangay',data:{barangay:form.barangay,street:form.street?.slice(0,30)},timestamp:Date.now(),hypothesisId:'H1-H3',runId:'publish-debug'})}).catch(()=>{});
      // #endregion
      return;
    }
    setFormError('');
    setCreating(true);
    try {
      let barangay = form.barangay.trim();
      if (!barangay) {
        const address = await fetchAddressFromCoordinates(Number(form.latitude), Number(form.longitude));
        barangay = address.barangay.trim();
      }
      const payload = {
        title: form.title,
        description: form.description || null,
        task_type: form.task_type,
        barangay: barangay || null,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        reward_type: form.reward_type || null,
        collaborators: form.collaboratorSlots.map(partySlotToEntry).filter(Boolean),
        sponsors: form.sponsorSlots.map(partySlotToEntry).filter(Boolean),
        required_proof: {
          gps: form.requireGps,
          before_photo: form.requireBefore,
          after_photo: form.requireAfter,
          qr: form.requireQr,
        },
      };
      // #region agent log
      fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ed5453'},body:JSON.stringify({sessionId:'ed5453',location:'LGUEcoQuestPage.tsx:createTask:pre-api',message:'calling POST /api/ecoquest/tasks',data:{title:payload.title,barangay:payload.barangay,collabCount:payload.collaborators.length,sponsorCount:payload.sponsors.length},timestamp:Date.now(),hypothesisId:'H2-H5',runId:'publish-debug'})}).catch(()=>{});
      // #endregion
      await api('/api/ecoquest/tasks', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      // #region agent log
      fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ed5453'},body:JSON.stringify({sessionId:'ed5453',location:'LGUEcoQuestPage.tsx:createTask:success',message:'task created',data:{title:payload.title},timestamp:Date.now(),hypothesisId:'H2',runId:'publish-debug'})}).catch(()=>{});
      // #endregion
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFormError(msg.slice(0, 300) || 'Could not publish task.');
      // #region agent log
      fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ed5453'},body:JSON.stringify({sessionId:'ed5453',location:'LGUEcoQuestPage.tsx:createTask:error',message:'API create failed',data:{error:msg.slice(0,500)},timestamp:Date.now(),hypothesisId:'H2-H5',runId:'publish-debug'})}).catch(()=>{});
      // #endregion
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
        <form onSubmit={createTask} className="store-utility-card mt-6 space-y-6">
          <h2 className="font-semibold">New EcoQuest Task</h2>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-4">
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
                    onChange={(e) => setForm({ ...form, task_type: e.target.value as EcoQuestTaskType })}
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
                <label className="block text-sm md:col-span-2">
                  Reward type (optional)
                  <input
                    value={form.reward_type}
                    onChange={(e) => setForm({ ...form, reward_type: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-hairline px-3 py-2"
                    placeholder="e.g. service_hours, certificate"
                  />
                </label>
              </div>

              <PartySlotSection
                label="Collaborators"
                hint="People or organizations helping coordinate this task."
                addLabel="Add Collaborator"
                slots={form.collaboratorSlots}
                onChange={(collaboratorSlots) => setForm({ ...form, collaboratorSlots })}
              />

              <PartySlotSection
                label="Sponsors"
                hint="Organizations or contacts sponsoring rewards or recognition."
                addLabel="Add Sponsor"
                slots={form.sponsorSlots}
                onChange={(sponsorSlots) => setForm({ ...form, sponsorSlots })}
              />

              <RequiredProofSection
                values={{
                  requireGps: form.requireGps,
                  requireBefore: form.requireBefore,
                  requireAfter: form.requireAfter,
                  requireQr: form.requireQr,
                }}
                onChange={(proof) => setForm({ ...form, ...proof })}
              />
            </div>

            <div className="rounded-[20px] border border-hairline bg-canvas-parchment p-5">
              <LocationPickerSection
                embedded
                latitude={form.latitude}
                longitude={form.longitude}
                address={{
                  barangay: form.barangay,
                  street: form.street,
                  city: form.city,
                  province: form.province,
                }}
                autoDetectAddress
                onAddressChange={(addr) =>
                  setForm((prev) => ({
                    ...prev,
                    barangay: addr.barangay,
                    street: addr.street,
                    city: addr.city,
                    province: addr.province,
                  }))
                }
                onChange={(lat, lng) => setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }))}
                label="Task location"
                hint="Pin where volunteers should perform the task and check in."
              />
            </div>
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <ButtonPrimary type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'Publish Task'}
          </ButtonPrimary>
        </form>
      )}

      {qrTask ? (
        <EcoQuestTaskQrPanel
          taskId={qrTask.id}
          taskTitle={qrTask.title}
          open={Boolean(qrTask)}
          onClose={() => setQrTask(null)}
        />
      ) : null}

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
              {t.required_proof?.qr && t.qr_code_token && t.status !== 'closed' ? (
                <div className="mt-3">
                  <ButtonSecondaryPill onClick={() => setQrTask(t)}>Show Task QR</ButtonSecondaryPill>
                </div>
              ) : null}
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
