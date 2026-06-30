import { GlobalNav } from '../components/ui/GlobalNav';
import { SubNavFrosted } from '../components/ui/SubNavFrosted';
import { Footer } from '../components/ui/Footer';

export default function GalleryPage() {
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
        <div className="grid gap-6 md:grid-cols-2">
          {['Canal cleanup', 'Street restoration', 'Park revitalization'].map((title) => (
            <div key={title} className="store-utility-card aspect-video flex items-center justify-center bg-canvas-parchment">
              <p className="text-sm text-ink-muted-48">{title} — coming soon</p>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
