import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isFullscreenActive(): boolean {
  const doc = document as FullscreenDocument;
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}

export function useMobileImmersiveMode(rootRef: RefObject<HTMLElement | null>) {
  const [isImmersive, setIsImmersive] = useState(isStandaloneDisplay);
  const [isStandalone] = useState(isStandaloneDisplay);
  const [showEnterHint, setShowEnterHint] = useState(() => !isStandaloneDisplay());
  const enteredRef = useRef(false);

  const syncImmersiveState = useCallback(() => {
    setIsImmersive(isStandaloneDisplay() || isFullscreenActive());
  }, []);

  const enterImmersive = useCallback(async () => {
    if (isStandaloneDisplay() || isFullscreenActive()) {
      setShowEnterHint(false);
      setIsImmersive(true);
      return;
    }

    const target = (rootRef.current ?? document.documentElement) as FullscreenElement;
    try {
      if (target.requestFullscreen) {
        await target.requestFullscreen();
      } else if (target.webkitRequestFullscreen) {
        await target.webkitRequestFullscreen();
      }
      setShowEnterHint(false);
      enteredRef.current = true;
    } catch {
      // Browsers require a user gesture; hint stays visible until the next tap.
    } finally {
      syncImmersiveState();
      window.setTimeout(() => window.scrollTo(0, 1), 50);
    }
  }, [rootRef, syncImmersiveState]);

  const exitImmersive = useCallback(async () => {
    const doc = document as FullscreenDocument;
    try {
      if (doc.fullscreenElement && doc.exitFullscreen) {
        await doc.exitFullscreen();
      } else if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      }
    } catch {
      // Ignore — fallback navigation still gives users a way out.
    }

    syncImmersiveState();
    setShowEnterHint(true);
    enteredRef.current = false;

    if (isStandaloneDisplay()) {
      window.location.assign('/');
    }
  }, [syncImmersiveState]);

  useEffect(() => {
    syncImmersiveState();

    const onFullscreenChange = () => syncImmersiveState();
    const onStandaloneChange = () => syncImmersiveState();

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange as EventListener);
    window
      .matchMedia('(display-mode: standalone)')
      .addEventListener('change', onStandaloneChange);
    window
      .matchMedia('(display-mode: fullscreen)')
      .addEventListener('change', onStandaloneChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange as EventListener);
      window
        .matchMedia('(display-mode: standalone)')
        .removeEventListener('change', onStandaloneChange);
      window
        .matchMedia('(display-mode: fullscreen)')
        .removeEventListener('change', onStandaloneChange);
    };
  }, [syncImmersiveState]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onFirstGesture = () => {
      if (!enteredRef.current && !isStandaloneDisplay() && !isFullscreenActive()) {
        void enterImmersive();
      }
    };

    root.addEventListener('pointerdown', onFirstGesture, { passive: true });
    return () => root.removeEventListener('pointerdown', onFirstGesture);
  }, [enterImmersive, rootRef]);

  return {
    isImmersive,
    isStandalone,
    showEnterHint,
    enterImmersive,
    exitImmersive,
  };
}
