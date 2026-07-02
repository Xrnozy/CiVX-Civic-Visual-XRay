import type { ReactNode } from 'react';
import {
  EVENT_BANNER_PLACEHOLDER,
  EVENT_CATEGORY_LABEL,
  ORGANIZER_AVATAR_PLACEHOLDER,
} from '../../types/eventDetail';

interface Props {
  title: string;
  organizerName: string;
  organizerPhotoUrl?: string | null;
  bannerUrl?: string | null;
  bannerActions?: ReactNode;
}

function organizerInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function EventDetailHeader({
  title,
  organizerName,
  organizerPhotoUrl,
  bannerUrl,
  bannerActions,
}: Props) {
  const avatarSrc = organizerPhotoUrl?.trim() || ORGANIZER_AVATAR_PLACEHOLDER;
  const bannerSrc = bannerUrl?.trim() || EVENT_BANNER_PLACEHOLDER;

  return (
    <header className="overflow-hidden rounded-[24px] border border-hairline bg-canvas shadow-sm">
      <div className="relative h-48 sm:h-64 md:h-72">
        <img src={bannerSrc} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
        {bannerActions ? (
          <div className="absolute right-4 top-4 flex flex-wrap justify-end gap-2 sm:right-6 sm:top-6">
            {bannerActions}
          </div>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 p-5 sm:p-6">
          <div className="relative shrink-0">
            {organizerPhotoUrl ? (
              <img
                src={avatarSrc}
                alt=""
                className="h-16 w-16 rounded-full border-4 border-white object-cover shadow-lg sm:h-20 sm:w-20"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-primary/90 text-lg font-semibold text-white shadow-lg sm:h-20 sm:w-20 sm:text-xl">
                {organizerInitials(organizerName) || 'OG'}
              </div>
            )}
          </div>
          <div className="min-w-0 pb-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
              {EVENT_CATEGORY_LABEL}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
            <p className="mt-1 text-sm text-white/85">Organized by {organizerName}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
