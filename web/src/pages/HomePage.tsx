import { GlobalNav } from '../components/ui/GlobalNav';
import { ProductTile } from '../components/ui/ProductTile';
import { Footer } from '../components/ui/Footer';
import { StatCard } from '../components/ui/StatCard';
import { usePolling } from '../hooks/useDashboardSocket';

const features = [
  {
    title: 'Report with GPS',
    desc: 'Citizens photograph issues with automatic location tagging and AI-assisted classification.',
  },
  {
    title: 'Duplicate merging',
    desc: 'Nearby reports of the same issue merge into one incident so LGUs avoid redundant work.',
  },
  {
    title: 'Community response',
    desc: 'Cleanup events, volunteer attendance, and EcoQuest tasks connect problems to solutions.',
  },
];

export default function HomePage() {
  const impact = usePolling<{ resolved_incidents: number; approved_cleanups: number }>(
    '/api/analytics/community-impact',
  );

  return (
    <div className="min-h-screen bg-canvas">
      <GlobalNav />
      <ProductTile
        variant="light"
        eyebrow="Civic Visual X-Ray"
        title="CiVX"
        tagline="See what the city needs. Report issues, join cleanups, and help your community respond faster."
        ctaPrimary={{ label: 'View Map', to: '/map' }}
        ctaSecondary={{ label: 'Join Events', to: '/events' }}
        showVisual
      />

      <section className="section-band-parchment">
        <div className="section-inner">
          <p className="section-eyebrow text-center">Impact</p>
          <h2 className="section-title text-center">Community at a glance</h2>
          <p className="section-lead">Live signals from reports, cleanups, and verified resolutions across the city.</p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <StatCard label="Issues resolved" value={impact?.resolved_incidents ?? '—'} />
            <StatCard label="Cleanups approved" value={impact?.approved_cleanups ?? '—'} />
            <StatCard label="Active citizens" value="Open" />
          </div>
        </div>
      </section>

      <ProductTile
        variant="dark"
        eyebrow="AI + Operations"
        title="Civic intelligence for everyone"
        tagline="AI-assisted detection, duplicate merging, and LGU coordination — built for real communities."
        ctaPrimary={{ label: 'Report an Issue', to: '/report' }}
        ctaSecondary={{ label: 'LGU Dashboard', to: '/lgu' }}
      />

      <section className="section-band-canvas">
        <div className="section-inner">
          <p className="section-eyebrow text-center">Platform</p>
          <h2 className="section-title text-center">How CiVX works</h2>
          <p className="section-lead">From citizen report to LGU resolution — one coordinated platform.</p>
          <div className="feature-grid mt-12">
            {features.map((f, i) => (
              <div key={f.title} className="feature-item">
                <div className="feature-icon">{i + 1}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ProductTile
        variant="parchment"
        title="Ready to make a difference?"
        tagline="Join your neighbors in building a cleaner, safer city."
        ctaPrimary={{ label: 'Explore the Map', to: '/map' }}
      />
      <Footer />
    </div>
  );
}
