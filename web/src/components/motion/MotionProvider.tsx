import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import {
  gsap,
  isHeavyMapRoute,
  isMobileDemoRoute,
  prefersReducedMotion,
  REVEAL_SELECTOR,
  ScrollTrigger,
  useGSAP,
  MOTION,
} from '../../animations/gsap';

interface Props {
  children: ReactNode;
}

export function MotionProvider({ children }: Props) {
  const location = useLocation();

  useEffect(() => {
    document.documentElement.classList.add('motion-ready');
    return () => {
      document.documentElement.classList.remove('motion-ready');
    };
  }, []);

  useGSAP(
    () => {
      if (prefersReducedMotion() || isHeavyMapRoute(location.pathname) || isMobileDemoRoute(location.pathname)) return;

      const targets = gsap.utils.toArray<Element>(REVEAL_SELECTOR).filter(
        (el) => !el.closest('nav, .sub-nav-frosted, .mobile-demo-header, .mobile-tab-bar, .dispatch-layout nav, [data-no-motion]'),
      );
      if (!targets.length) return;

      gsap.set(targets, { y: 22, autoAlpha: 0 });

      ScrollTrigger.batch(targets, {
        interval: 0.08,
        batchMax: 6,
        onEnter: (batch) => {
          gsap.to(batch, {
            y: 0,
            autoAlpha: 1,
            duration: MOTION.revealDuration,
            ease: MOTION.ease,
            stagger: MOTION.revealStagger,
            overwrite: 'auto',
          });
        },
        start: 'top 92%',
        once: true,
      });

      ScrollTrigger.refresh();
    },
    { dependencies: [location.pathname], revertOnUpdate: true },
  );

  return children;
}
