import { Outlet, NavLink } from 'react-router-dom';
import { GlobalNav } from '../../components/ui/GlobalNav';

const links = [
  { to: '/dispatch', label: 'Cases', end: true },
  { to: '/dispatch/map', label: 'Map' },
];

export function DispatchLayout() {
  return (
    <div className="dispatch-layout">
      <GlobalNav />
      <header className="border-b border-hairline bg-white px-6 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Field verification</p>
        <h1 className="text-2xl font-semibold text-ink">Dispatch dashboard</h1>
        <p className="mt-1 text-sm text-ink-muted-48">
          Verify reported issues on site, document findings, and update case status.
        </p>
        <nav className="mt-4 flex gap-2">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => `dispatch-nav-link ${isActive ? 'dispatch-nav-link-active' : ''}`}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
