import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface Impact {
  resolved_incidents?: number;
  approved_cleanups?: number;
  active_incidents?: number;
}

export default function MobileHome() {
  const [impact, setImpact] = useState<Impact | null>(null);

  useEffect(() => {
    fetch('/api/analytics/community-impact')
      .then((r) => r.json())
      .then(setImpact)
      .catch(() => setImpact(null));
  }, []);

  return (
    <div className="space-y-4 p-4">
      <section className="ui-card">
        <p className="ui-card-title">Civic Visual X-Ray</p>
        <h1 className="mt-2 text-xl font-semibold text-ink">Turn city issues into coordinated action.</h1>
        <p className="mt-2 text-sm text-ink-muted-48">
          Report visible problems, explore the map, and track community cleanup progress.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/mobile/report" className="btn-primary text-sm">
            Report issue
          </Link>
          <Link to="/mobile/map" className="btn-secondary-pill text-sm">
            Explore map
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <div className="ui-card text-center">
          <p className="text-2xl font-semibold text-primary">{impact?.active_incidents ?? '—'}</p>
          <p className="text-xs text-ink-muted-48">Live reports</p>
        </div>
        <div className="ui-card text-center">
          <p className="text-2xl font-semibold text-primary">{impact?.approved_cleanups ?? '—'}</p>
          <p className="text-xs text-ink-muted-48">Cleanups</p>
        </div>
      </div>

      <section className="ui-card">
        <p className="font-semibold text-ink">Quick actions</p>
        <ul className="mt-3 space-y-2 text-sm">
          <li>
            <Link to="/mobile/camera" className="text-primary">
              Passive camera — AI street scanning
            </Link>
          </li>
          <li>
            <Link to="/mobile/ecoquest" className="text-primary">
              EcoQuest micro-tasks
            </Link>
          </li>
          <li>
            <Link to="/mobile/events" className="text-primary">
              Join cleanup events
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
