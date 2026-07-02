import { Link } from 'react-router-dom';
import { formatCleanupDateBadge } from '../../lib/eventSchedule';

/** Matches the no-banner cleanup preview card on the civic map. */
export const CLEANUP_EVENT_CARD_GREEN =
  'bg-[linear-gradient(145deg,#0f766e_0%,#134e4a_100%)]';

const OVERLAY_GRADIENT =
  'bg-[linear-gradient(180deg,rgba(0,0,0,0.38)_0%,rgba(0,0,0,0.08)_38%,rgba(0,0,0,0.08)_52%,rgba(0,0,0,0.78)_100%)]';

interface Props {
  title: string;
  barangay?: string;
  scheduledStart: string;
  bannerUrl?: string | null;
  subtitle?: string;
  to?: string;
  className?: string;
}

export function CleanupEventPreviewCard({
  title,
  barangay,
  scheduledStart,
  bannerUrl,
  subtitle = 'Approved cleanup drive',
  to,
  className = '',
}: Props) {
  const banner = bannerUrl?.trim();
  const locationLabel = (barangay || 'Community cleanup').toUpperCase();

  const card = (
    <div
      className={`group relative aspect-square w-full overflow-hidden rounded-[18px] shadow-[0_18px_40px_rgba(0,0,0,0.18)] transition duration-300 hover:shadow-[0_18px_40px_rgba(0,0,0,0.28)] ${className}`}
    >
      {banner ? (
        <img
          src={banner}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <div className={`absolute inset-0 ${CLEANUP_EVENT_CARD_GREEN}`} />
      )}

      <div className={`absolute inset-0 ${OVERLAY_GRADIENT}`} />

      <p className="absolute inset-x-4 top-4 text-[10px] font-semibold leading-snug tracking-[0.08em] text-white/95 [text-shadow:0_1px_4px_rgba(0,0,0,0.55)]">
        {locationLabel}
      </p>

      <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-2.5">
        <div className="min-w-0 pr-1">
          <h3 className="text-[22px] font-extrabold leading-[1.05] tracking-[0.01em] text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.5)] line-clamp-3">
            {title.toUpperCase()}
          </h3>
          <p className="mt-2 text-[11px] font-medium text-white/95 [text-shadow:0_1px_4px_rgba(0,0,0,0.45)]">
            {subtitle}
          </p>
        </div>
        <div className="shrink-0 rounded-full bg-black/60 px-[11px] py-1.5 text-[10px] font-bold tracking-[0.05em] text-white backdrop-blur-sm">
          {formatCleanupDateBadge(scheduledStart)}
        </div>
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block no-underline">
        {card}
      </Link>
    );
  }

  return card;
}
