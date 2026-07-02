import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { mdiAccountCircleOutline } from '@mdi/js';

interface Impact {
  resolved_incidents?: number;
  approved_cleanups?: number;
  active_incidents?: number;
  verification_rate?: number;
}

const highlights = [
  { title: 'Citizen reporting', body: 'Submit photos and GPS-backed reports in seconds.' },
  { title: 'Community coordination', body: 'Join approved cleanup events and volunteer actions.' },
  { title: 'LGU visibility', body: 'Track progress from detection to resolution in one place.' },
];

const quickActions = [
  { to: '/mobile/report', label: 'Report', caption: 'Capture a visible issue' },
  { to: '/mobile/ecoquest', label: 'EcoQuest', caption: 'Complete micro-tasks' },
];

function formatStat(value: number | null | undefined) {
  return typeof value === 'number' ? String(value) : '-';
}

function formatPercent(value: number | null | undefined) {
  return typeof value === 'number' ? `${value}%` : '-';
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
    <div className="mobile-native-home">
      <Link to="/mobile/account" className="mobile-profile-float" aria-label="Account">
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d={mdiAccountCircleOutline} fill="currentColor" />
        </svg>
      </Link>

      <section className="mobile-native-tile mobile-native-tile-light">
        <p className="mobile-native-eyebrow">Civic Visual X-Ray</p>
        <h1>Turn city issues into coordinated action.</h1>
        <p className="mobile-native-subtitle">
          CiVX helps residents, volunteers, and LGU teams report visible problems, verify them faster, and resolve them together.
        </p>

        <div className="mobile-native-button-row">
          <Link to="/mobile/report" className="mobile-native-button-primary">Report issue</Link>
          <Link to="/mobile/map" className="mobile-native-button-secondary">Explore map</Link>
        </div>

        <div className="mobile-native-stat-row">
          <div>
            <strong>{formatStat(impact?.active_incidents)}</strong>
            <span>Live reports</span>
          </div>
          <div>
            <strong>{formatStat(impact?.approved_cleanups)}</strong>
            <span>Cleanups</span>
          </div>
          <div>
            <strong>{formatPercent(impact?.verification_rate)}</strong>
            <span>Verified</span>
          </div>
        </div>
      </section>

      <section className="mobile-native-tile mobile-native-tile-dark">
        <p className="mobile-native-eyebrow">What the app supports</p>
        <h2>See nearby issues, join cleanup drives, and keep the response visible.</h2>
        <div className="mobile-native-card-list">
          {highlights.map((item) => (
            <article key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mobile-native-tile mobile-native-tile-light mobile-native-fast-actions">
        <h2>Fast actions</h2>
        <div>
          {quickActions.map((action) => (
            <Link key={action.to} to={action.to}>
              <strong>{action.label}</strong>
              <span>{action.caption}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
