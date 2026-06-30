import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ButtonPrimary, ButtonSecondaryPill } from './Buttons';
import { CivicHeroVisual } from './CivicHeroVisual';

interface Props {
  variant?: 'light' | 'dark' | 'parchment';
  eyebrow?: string;
  title: string;
  tagline: string;
  ctaPrimary?: { label: string; to: string };
  ctaSecondary?: { label: string; to: string };
  showVisual?: boolean;
  children?: ReactNode;
}

const variants = {
  light: 'product-tile-light',
  dark: 'product-tile-dark',
  parchment: 'product-tile-parchment',
};

export function ProductTile({
  variant = 'light',
  eyebrow,
  title,
  tagline,
  ctaPrimary,
  ctaSecondary,
  showVisual = false,
  children,
}: Props) {
  const cls = variants[variant];
  const isDark = variant === 'dark';

  return (
    <section className={cls}>
      <div className="mx-auto max-w-4xl">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className={`text-[40px] font-semibold tracking-tight md:text-[56px] ${isDark ? 'text-white' : 'text-ink'}`}>
          {title}
        </h1>
        <p className={`mx-auto mt-4 max-w-2xl text-[21px] font-normal leading-snug md:text-[28px] ${isDark ? 'text-body-muted' : 'text-ink-muted-80'}`}>
          {tagline}
        </p>
        {(ctaPrimary || ctaSecondary) && (
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            {ctaPrimary && (
              <Link to={ctaPrimary.to}>
                <ButtonPrimary>{ctaPrimary.label}</ButtonPrimary>
              </Link>
            )}
            {ctaSecondary && (
              <Link to={ctaSecondary.to}>
                <ButtonSecondaryPill>{ctaSecondary.label}</ButtonSecondaryPill>
              </Link>
            )}
          </div>
        )}
        {showVisual && <CivicHeroVisual variant={isDark ? 'dark' : 'light'} />}
        {children && <div className="mt-12">{children}</div>}
      </div>
    </section>
  );
}
