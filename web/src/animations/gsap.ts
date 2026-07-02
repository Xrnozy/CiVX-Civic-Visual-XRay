import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, useGSAP);

export const MOTION = {
  pageDuration: 0.42,
  revealDuration: 0.5,
  revealStagger: 0.06,
  ease: 'power2.out',
} as const;

const HEAVY_MAP_ROUTES = new Set(['/map', '/dispatch/map', '/mobile/map']);

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function isHeavyMapRoute(pathname: string): boolean {
  if (HEAVY_MAP_ROUTES.has(pathname)) return true;
  return pathname.startsWith('/mobile/map');
}

export function isMobileDemoRoute(pathname: string): boolean {
  return pathname === '/mobile' || pathname.startsWith('/mobile/');
}

export const REVEAL_SELECTOR =
  '[data-reveal], .stat-card, .feature-item, .ui-card, .section-title, .section-lead';

export { gsap, ScrollTrigger, useGSAP };
