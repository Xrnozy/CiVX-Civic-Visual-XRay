import { Link, useLocation } from 'react-router-dom';

const links = [
  { to: '/map', label: 'Map' },
  { to: '/events', label: 'Events' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/transparency', label: 'Transparency' },
  { to: '/lgu', label: 'LGU' },
];

export function GlobalNav() {
  const location = useLocation();

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-surface-black/95 backdrop-blur-md">
      <div className="mx-auto flex h-11 max-w-[1440px] items-center justify-between px-6 text-xs text-white">
        <Link to="/" className="text-sm font-semibold tracking-tight text-white">
          CiVX
        </Link>
        <div className="hidden gap-6 md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`transition hover:text-white ${location.pathname.startsWith(l.to) ? 'text-white' : 'text-white/70'}`}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <Link to="/login" className="btn-dark-utility">
          Sign In
        </Link>
      </div>
    </nav>
  );
}
