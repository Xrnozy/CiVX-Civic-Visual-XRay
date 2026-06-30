import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-hairline bg-canvas-parchment">
      <div className="mx-auto grid max-w-[980px] gap-10 px-6 py-16 text-ink-muted-80 md:grid-cols-4">
        <div>
          <p className="text-sm font-semibold text-ink">CiVX</p>
          <p className="mt-3 text-sm leading-[2.41]">
            Civic Visual X-Ray — AI-powered civic intelligence for smarter, cleaner communities.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">Community</p>
          <div className="mt-3 flex flex-col gap-1 text-sm leading-[2.41]">
            <Link to="/map" className="hover:text-primary">Community Map</Link>
            <Link to="/events" className="hover:text-primary">Cleanup Events</Link>
            <Link to="/gallery" className="hover:text-primary">Impact Gallery</Link>
            <Link to="/transparency" className="hover:text-primary">Transparency</Link>
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">Government</p>
          <div className="mt-3 flex flex-col gap-1 text-sm leading-[2.41]">
            <Link to="/lgu" className="hover:text-primary">LGU Dashboard</Link>
            <Link to="/lgu/queue" className="hover:text-primary">Incident Queue</Link>
            <Link to="/lgu/analytics" className="hover:text-primary">Analytics</Link>
          </div>
        </div>
        <div className="flex flex-col justify-end">
          <p className="text-xs text-ink-muted-48">© 2026 CiVX</p>
          <p className="mt-1 text-xs text-ink-muted-48">Hackathon demo · civx.xrnozy.me</p>
        </div>
      </div>
    </footer>
  );
}
