import { useRef, type ReactNode } from 'react';
import { gsap, prefersReducedMotion, useGSAP } from '../../animations/gsap';

interface Props {
  children: ReactNode;
  className?: string;
}

/** Centered reveal for map drawers — transform/opacity only. */
export function SlideInPanel({ children, className = '' }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!panelRef.current || prefersReducedMotion()) return;
      gsap.fromTo(
        panelRef.current,
        { scale: 0.94, autoAlpha: 0, y: 12 },
        { scale: 1, autoAlpha: 1, y: 0, duration: 0.34, ease: 'power2.out', transformOrigin: 'center center' },
      );
    },
    { scope: panelRef },
  );

  return (
    <div ref={panelRef} className={className}>
      {children}
    </div>
  );
}
