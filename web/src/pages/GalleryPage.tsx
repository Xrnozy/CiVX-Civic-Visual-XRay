import { useEffect, useState } from 'react';
import { GlobalNav } from '../components/ui/GlobalNav';
import { SubNavFrosted } from '../components/ui/SubNavFrosted';
import { Footer } from '../components/ui/Footer';
import { BeforeAfterCard, type GalleryEntry } from '../components/gallery/BeforeAfterCard';
import { api } from '../lib/api';

export default function GalleryPage() {
  const [entries, setEntries] = useState<GalleryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<GalleryEntry[]>('/api/cleanup-events/gallery')
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-canvas">
      <GlobalNav />
      <SubNavFrosted title="Before & After Gallery" lead="Community cleanup impact from completed events" />
      <section className="page-hero">
        <h1 className="page-hero-title">Community impact</h1>
        <p className="page-hero-lead">
          Before and after photos from volunteer cleanup drives appear here once events are completed and proof is uploaded.
        </p>
      </section>
      <div className="page-content">
        {loading && (
          <p className="text-center text-sm text-ink-muted-48">Loading gallery…</p>
        )}
        {!loading && entries.length === 0 && (
          <div className="store-utility-card py-16 text-center">
            <p className="text-[21px] font-semibold text-ink">No gallery entries yet</p>
            <p className="mt-2 text-sm text-ink-muted-48">
              Completed cleanup drives with before and after photos will appear here.
            </p>
          </div>
        )}
        {entries.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {entries.map((entry) => (
              <BeforeAfterCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
