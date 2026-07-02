import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type {
  BatchCertificateSendResult,
  CertificateSendResult,
  EventRoster,
  VolunteerAttendance,
} from '../../types/attendance';
import { AttendanceSummaryBar } from '../lgu/attendance/AttendanceSummaryBar';
import { AttendanceTable } from '../lgu/attendance/AttendanceTable';
import { ButtonPrimary, ButtonSecondaryPill } from '../ui/Buttons';

const POLL_MS = 10000;

function parseApiError(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    try {
      const json = JSON.parse(err.message) as { detail?: string };
      if (json.detail) return json.detail;
    } catch {
      /* plain text */
    }
    return err.message || fallback;
  }
  return fallback;
}

interface Props {
  eventId: string;
  active: boolean;
}

export function OrganizerAttendancePanel({ eventId, active }: Props) {
  const [roster, setRoster] = useState<EventRoster | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingUserId, setSendingUserId] = useState<string | null>(null);
  const [batchSending, setBatchSending] = useState(false);
  const [autoSend, setAutoSend] = useState(true);
  const [autoSendSaving, setAutoSendSaving] = useState(false);
  const [message, setMessage] = useState('');

  const loadRoster = useCallback(() => {
    if (!eventId) return;
    setLoading(true);
    api<EventRoster>(`/api/attendance/events/${eventId}`)
      .then((data) => {
        setRoster(data);
        setAutoSend(data.event.auto_send_certificates !== false);
      })
      .catch(() => setRoster(null))
      .finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    if (!active || !eventId) return;
    loadRoster();
    const id = setInterval(loadRoster, POLL_MS);
    return () => clearInterval(id);
  }, [active, eventId, loadRoster]);

  const pendingCount =
    roster?.volunteers.filter(
      (v) => v.tracker_status === 'completed' && v.email && !v.certificate_sent_at,
    ).length ?? 0;

  async function handleAutoSendToggle(enabled: boolean) {
    setAutoSend(enabled);
    setAutoSendSaving(true);
    setMessage('');
    try {
      await api(`/api/attendance/events/${eventId}/certificate-settings`, {
        method: 'PATCH',
        body: JSON.stringify({ auto_send_certificates: enabled }),
      });
      setMessage(enabled ? 'Auto-send enabled — certificates email on checkout.' : 'Auto-send disabled.');
    } catch (err) {
      setAutoSend(!enabled);
      setMessage(parseApiError(err, 'Unable to update certificate settings.'));
    } finally {
      setAutoSendSaving(false);
    }
  }

  async function handleSend(v: VolunteerAttendance) {
    setSendingUserId(v.user_id);
    setMessage('');
    try {
      const result = await api<CertificateSendResult>(
        `/api/attendance/events/${eventId}/certificates/${v.user_id}/send${v.certificate_sent_at ? '?force=true' : ''}`,
        { method: 'POST' },
      );
      if (result.sent) {
        setMessage(`Certificate sent to ${result.email} (mock mode — check backend console).`);
      } else if (result.reason === 'no_email') {
        setMessage(`${v.full_name} has no email on file.`);
      } else if (result.reason === 'already_sent') {
        setMessage(`Certificate was already sent to ${v.full_name}.`);
      }
      loadRoster();
    } catch (err) {
      setMessage(parseApiError(err, 'Unable to send certificate.'));
    } finally {
      setSendingUserId(null);
    }
  }

  async function handleBatchSend() {
    if (pendingCount === 0) {
      setMessage('No pending certificates to send.');
      return;
    }
    if (!window.confirm(`Send certificates to ${pendingCount} volunteer(s)?`)) return;

    setBatchSending(true);
    setMessage('');
    try {
      const result = await api<BatchCertificateSendResult>(
        `/api/attendance/events/${eventId}/certificates/batch-send`,
        { method: 'POST' },
      );
      setMessage(
        `Batch complete: ${result.sent_count} sent, ${result.skipped_count} skipped (mock mode — check backend console).`,
      );
      loadRoster();
    } catch (err) {
      setMessage(parseApiError(err, 'Unable to batch send certificates.'));
    } finally {
      setBatchSending(false);
    }
  }

  return (
    <div className="space-y-4" role="tabpanel">
      <p className="text-xs text-ink-muted-80">
        Tracker-based attendance updates automatically. Send volunteer certificates by email when checkout is complete.
      </p>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-hairline bg-canvas-parchment px-3 py-2">
        <label className="flex items-center gap-2 text-xs font-medium text-ink">
          <input
            type="checkbox"
            checked={autoSend}
            disabled={autoSendSaving}
            onChange={(e) => void handleAutoSendToggle(e.target.checked)}
          />
          Auto-send certificates on checkout
        </label>
        <ButtonPrimary
          className="!px-3 !py-1.5 text-xs"
          disabled={batchSending || pendingCount === 0}
          onClick={() => void handleBatchSend()}
        >
          {batchSending ? 'Sending…' : `Batch send (${pendingCount})`}
        </ButtonPrimary>
        <ButtonSecondaryPill className="!px-3 !py-1.5 text-xs" onClick={() => loadRoster()}>
          Refresh
        </ButtonSecondaryPill>
      </div>

      {message ? (
        <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900">{message}</p>
      ) : null}

      {loading && !roster ? (
        <p className="text-xs text-ink-muted-48">Loading attendance…</p>
      ) : (
        <>
          <AttendanceSummaryBar summary={roster?.summary ?? null} />
          <AttendanceTable
            mode="organizer"
            roster={roster}
            onSendCertificate={(v) => void handleSend(v)}
            sendingUserId={sendingUserId}
          />
        </>
      )}
    </div>
  );
}
