interface Props {
  title: string;
  latitude?: number;
  longitude?: number;
  compact?: boolean;
}

function hasCoords(latitude?: number, longitude?: number): boolean {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function mapsEmbedUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
}

export function EventMapEmbed({ title, latitude, longitude, compact = false }: Props) {
  const located = hasCoords(latitude, longitude);

  return (
    <section>
      <h2 className={compact ? 'text-xs font-medium text-ink-muted-48' : 'text-sm font-medium text-ink'}>
        Location pin
      </h2>
      {located ? (
        <div className="mt-1.5 overflow-hidden rounded-[12px] border border-hairline">
          <iframe
            title={`Map pin for ${title}`}
            src={mapsEmbedUrl(Number(latitude), Number(longitude))}
            className={`pointer-events-none w-full border-0 ${compact ? 'h-[120px]' : 'h-[220px] sm:h-[260px]'}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      ) : (
        <div
          className={`mt-1.5 rounded-[12px] border border-dashed border-hairline bg-canvas-parchment text-center text-xs text-ink-muted-48 ${
            compact ? 'px-3 py-4' : 'px-4 py-10 text-sm'
          }`}
        >
          No location pinned.
        </div>
      )}
    </section>
  );
}
