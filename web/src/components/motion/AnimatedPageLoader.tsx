import { useRef } from 'react';
import { gsap, prefersReducedMotion, useGSAP } from '../../animations/gsap';
import { PageLoader } from '../ui/PageLoader';

export function AnimatedPageLoader() {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!rootRef.current || prefersReducedMotion()) return;
      gsap.fromTo(
        rootRef.current,
        { autoAlpha: 0, y: 8 },
        { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out' },
      );
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef}>
      <PageLoader />
    </div>
  );
}
