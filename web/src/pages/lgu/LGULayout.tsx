import { Link, Outlet } from 'react-router-dom';
import { GlobalNav } from '../../components/ui/GlobalNav';
import { SubNavFrosted } from '../../components/ui/SubNavFrosted';

const lguLinks = [
  { to: '/lgu', label: 'Overview' },
  { to: '/lgu/queue', label: 'Queue' },
  { to: '/lgu/map', label: 'Map' },
  { to: '/lgu/cleanup', label: 'Cleanup' },
  { to: '/lgu/attendance', label: 'Attendance' },
  { to: '/lgu/ecoquest', label: 'EcoQuest' },
  { to: '/lgu/analytics', label: 'Analytics' },
];

export function LGULayout() {
  return (
    <>
      <GlobalNav />
      <SubNavFrosted
        title="LGU Dashboard"
        action={<Link to="/lgu/queue" className="btn-primary text-sm">Review Queue</Link>}
      >
        {lguLinks.map((l) => (
          <Link key={l.to} to={l.to} className="hidden text-primary md:inline">{l.label}</Link>
        ))}
      </SubNavFrosted>
      <Outlet />
    </>
  );
}
