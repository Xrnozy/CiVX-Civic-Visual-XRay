interface Props {
  reason?: string | null;
  compact?: boolean;
}

export function CleanupRejectionReason({ reason, compact = false }: Props) {
  const text = reason?.trim() || 'No rejection reason was recorded for this drive.';

  return (
    <div
      className={`rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 ${
        compact ? 'mt-2' : ''
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-red-800">Rejection reason</p>
      <p className={`mt-2 leading-relaxed text-red-900 ${compact ? 'text-sm line-clamp-3' : 'text-sm'}`}>
        {text}
      </p>
    </div>
  );
}
