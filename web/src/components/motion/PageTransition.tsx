import { useRef, type ReactNode } from 'react';
import {
  gsap,
  isHeavyMapRoute,
  isMobileDemoRoute,
  prefersReducedMotion,
  useGSAP,
  MOTION,
} from '../../animations/gsap';

interface Props {
  routeKey: string;
  children: ReactNode;
}

export function PageTransition({ routeKey, children }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!rootRef.current || prefersReducedMotion() || isMobileDemoRoute(routeKey)) return;

      const heavy = isHeavyMapRoute(routeKey);
      gsap.fromTo(
        rootRef.current,
        { autoAlpha: heavy ? 0.94 : 0, y: heavy ? 0 : 16 },
        {
          autoAlpha: 1,
          y: 0,
          duration: heavy ? 0.2 : MOTION.pageDuration,
          ease: MOTION.ease,
        },
      );
    },
    { scope: rootRef, dependencies: [routeKey], revertOnUpdate: true },
  );

  return (
    <div ref={rootRef} className="motion-page">
      {children}
    </div>
  );
}
