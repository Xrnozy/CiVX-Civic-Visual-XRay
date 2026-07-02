import { useState } from 'react';

export interface GalleryEntry {
  id: string;
  title?: string;
  barangay?: string;
  location?: string;
  resolution_date?: string;
  before_image_url: string;
  after_image_url: string;
}

interface Props {
  entry: GalleryEntry;
}

function formatResolutionDate(iso?: string) {
  if (!iso) return 'Date unavailable';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function BeforeAfterCard({ entry }: Props) {
  const [view, setView] = useState<'before' | 'after'>('before');
  const location = entry.location || entry.barangay || 'Unknown area';

  return (
    <article className="store-utility-card overflow-hidden p-0">
      <div className="relative aspect-[4/3] bg-canvas-parchment">
        <div className="hidden h-full md:grid md:grid-cols-2">
          <div className="relative border-r border-hairline">
            <img
              src={entry.before_image_url}
              alt={`Before cleanup in ${location}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <span className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
              Before
            </span>
          </div>
          <div className="relative">
            <img
              src={entry.after_image_url}
              alt={`After cleanup in ${location}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <span className="absolute left-3 top-3 rounded-full bg-primary/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
              After
            </span>
          </div>
        </div>

        <div className="relative h-full md:hidden">
          <img
            src={view === 'before' ? entry.before_image_url : entry.after_image_url}
            alt={`${view === 'before' ? 'Before' : 'After'} cleanup in ${location}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute left-3 top-3 flex rounded-full bg-black/50 p-1 backdrop-blur-sm">
            <button
              type="button"
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                view === 'before' ? 'bg-white text-ink' : 'text-white'
              }`}
              onClick={() => setView('before')}
            >
              Before
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                view === 'after' ? 'bg-primary text-white' : 'text-white'
              }`}
              onClick={() => setView('after')}
            >
              After
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-hairline px-5 py-4">
        {entry.title && <h3 className="text-[17px] font-semibold text-ink">{entry.title}</h3>}
        <p className="mt-1 text-sm text-ink-muted-80">{location}</p>
        <p className="mt-1 text-xs text-ink-muted-48">Completed {formatResolutionDate(entry.resolution_date)}</p>
      </div>
    </article>
  );
}
