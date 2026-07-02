import { useRef, type ReactNode } from 'react';
import { gsap, prefersReducedMotion, useGSAP } from '../../animations/gsap';

interface Props {
  children: ReactNode;
  className?: string;
}

/** Left-side reveal for map drawers — transform/opacity only. */
export function SlideInPanel({ children, className = '' }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!panelRef.current || prefersReducedMotion()) return;
      gsap.fromTo(
        panelRef.current,
        { x: -20, autoAlpha: 0 },
        { x: 0, autoAlpha: 1, duration: 0.34, ease: 'power2.out', transformOrigin: 'left center' },
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
