import type { EventParticipant } from '../../types/eventDetail';

interface Props {
  participants: EventParticipant[];
  loading: boolean;
  error: string;
  approvalStatus: string;
  compact?: boolean;
  embedded?: boolean;
  /** When true, list fills the tab panel with a taller scroll area. */
  tabPanel?: boolean;
}

export function EventVolunteerSidebar({
  participants,
  loading,
  error,
  approvalStatus,
  compact = false,
  embedded = false,
  tabPanel = false,
}: Props) {
  const list = (
    <>
      {!tabPanel ? (
        <h2 className={`shrink-0 font-semibold text-ink ${compact ? 'text-xs' : 'text-sm'}`}>
          Volunteers
        </h2>
      ) : null}
      {!compact && !tabPanel ? (
        <p className="mt-1 shrink-0 text-xs text-ink-muted-48">Names only — contact details stay private.</p>
      ) : null}
      {tabPanel ? (
        <p className="shrink-0 text-xs text-ink-muted-48">Names only — contact details stay private.</p>
      ) : null}

      <div
        className={`min-h-0 overflow-y-auto overscroll-contain ${
          tabPanel
            ? 'mt-3 min-h-[200px] flex-1 max-h-[min(420px,55vh)]'
            : compact
              ? 'mt-2 max-h-36'
              : 'mt-4 flex-1 max-h-[min(520px,70vh)]'
        }`}
      >
        {approvalStatus !== 'approved' ? (
          <p className="text-xs text-ink-muted-48">Names appear after LGU approval.</p>
        ) : error ? (
          <p className="text-xs text-red-700">{error}</p>
        ) : loading ? (
          <p className="text-xs text-ink-muted-48">Loading…</p>
        ) : participants.length === 0 ? (
          <p className="text-xs text-ink-muted-48">No volunteers yet.</p>
        ) : (
          <ul className={compact ? 'space-y-1' : 'space-y-1.5'}>
            {participants.map((participant) => (
              <li
                key={participant.user_id}
                className={`rounded-md bg-canvas-parchment font-medium text-ink ${
                  compact ? 'px-2 py-1 text-xs' : 'rounded-lg px-3 py-2 text-sm'
                }`}
              >
                {participant.full_name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );

  if (tabPanel) {
    return <div className="flex min-h-[240px] flex-col">{list}</div>;
  }

  if (embedded) {
    return <div className="border-t border-hairline pt-4">{list}</div>;
  }

  return (
    <aside
      className={`store-utility-card flex flex-col bg-canvas p-4 ${
        compact ? '' : 'max-h-[min(520px,70vh)] lg:sticky lg:top-24'
      }`}
    >
      {list}
    </aside>
  );
}
