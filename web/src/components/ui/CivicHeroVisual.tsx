interface Props {
  variant?: 'light' | 'dark';
}

export function CivicHeroVisual({ variant = 'light' }: Props) {
  const accent = variant === 'dark' ? '#2997ff' : '#0066cc';
  const grid = variant === 'dark' ? '#3a3a3c' : '#e8e8ed';
  const pin = variant === 'dark' ? '#ffffff' : '#1d1d1f';

  return (
    <div className="civic-visual" aria-hidden>
      <div className="civic-visual-inner">
        <svg viewBox="0 0 400 280" className="h-full w-full" fill="none">
          <defs>
            <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M24 0H0V24" stroke={grid} strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="400" height="280" fill="url(#grid)" opacity="0.6" />
          {/* Stylized city map */}
          <path d="M40 200 Q120 120 200 160 T360 140" stroke={accent} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.4" />
          <circle cx="120" cy="150" r="28" fill={accent} opacity="0.15" />
          <circle cx="120" cy="150" r="8" fill={accent} />
          <circle cx="240" cy="130" r="20" fill={accent} opacity="0.15" />
          <circle cx="240" cy="130" r="6" fill={accent} />
          <circle cx="300" cy="170" r="16" fill={accent} opacity="0.15" />
          <circle cx="300" cy="170" r="5" fill={accent} />
          {/* Pin */}
          <g transform="translate(180 90)">
            <path d="M0 0 C-14-28 28-28 0 0 Z" fill={pin} opacity="0.9" />
            <circle cx="0" cy="-12" r="6" fill={accent} />
          </g>
          <text x="200" y="250" textAnchor="middle" fill={variant === 'dark' ? '#ccc' : '#7a7a7a'} fontSize="12" fontFamily="Inter, sans-serif">
            Community civic map
          </text>
        </svg>
      </div>
    </div>
  );
}
