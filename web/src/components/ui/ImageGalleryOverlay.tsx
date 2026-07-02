import { useEffect } from 'react';

interface Props {
  images: string[];
  index: number;
  onClose: () => void;
  onChange: (index: number) => void;
  contained?: boolean;
  className?: string;
}

export function ImageGalleryOverlay({ images, index, onClose, onChange, contained = false, className = '' }: Props) {
  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key === 'ArrowLeft' && hasPrev) {
        onChange(index - 1);
      }
      if (event.key === 'ArrowRight' && hasNext) {
        onChange(index + 1);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasNext, hasPrev, index, onChange, onClose]);

  if (images.length === 0) return null;

  const current = images[index];

  const positionClass = contained
    ? (className || 'absolute inset-0 z-40')
    : `fixed inset-0 z-[100]${className ? ` ${className}` : ''}`;

  return (
    <div
      className={`${positionClass} flex items-center justify-center bg-black/45 p-4 backdrop-blur-md`}
      role="dialog"
      aria-modal="true"
      aria-label="Photo gallery"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Close gallery"
        className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white backdrop-blur hover:bg-white/20"
        onClick={onClose}
      >
        Close
      </button>

      {hasPrev ? (
        <button
          type="button"
          aria-label="Previous photo"
          className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 px-3 py-2 text-2xl leading-none text-white backdrop-blur hover:bg-white/20 sm:left-6"
          onClick={(event) => {
            event.stopPropagation();
            onChange(index - 1);
          }}
        >
          ‹
        </button>
      ) : null}

      <div className="flex max-h-full max-w-full flex-col items-center" onClick={(event) => event.stopPropagation()}>
        <div
          className={`flex items-center justify-center overflow-hidden rounded-[12px] bg-black/25 shadow-2xl ${
            contained ? 'h-[min(58vh,480px)] w-[min(calc(100%-2rem),640px)]' : 'h-[min(72vh,560px)] w-[min(92vw,720px)]'
          }`}
        >
          <img
            src={current}
            alt={`Incident photo ${index + 1} of ${images.length}`}
            className="h-full w-full object-contain"
          />
        </div>
        <p className="mt-4 text-sm font-medium text-white/90">
          {index + 1} / {images.length}
        </p>
      </div>

      {hasNext ? (
        <button
          type="button"
          aria-label="Next photo"
          className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 px-3 py-2 text-2xl leading-none text-white backdrop-blur hover:bg-white/20 sm:right-6"
          onClick={(event) => {
            event.stopPropagation();
            onChange(index + 1);
          }}
        >
          ›
        </button>
      ) : null}
    </div>
  );
}
