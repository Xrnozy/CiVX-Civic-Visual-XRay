import { ReactNode } from 'react';

interface Props {
  title: string;
  lead?: string;
  children?: ReactNode;
  action?: ReactNode;
}

export function SubNavFrosted({ title, lead, children, action }: Props) {
  return (
    <div className="sticky top-11 z-40 border-b border-black/5 bg-canvas-parchment/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div>
          <h1 className="text-[21px] font-semibold tracking-wide text-ink">{title}</h1>
          {lead && <p className="mt-1 text-sm text-ink-muted-48">{lead}</p>}
        </div>
        <div className="flex items-center gap-4 text-sm">
          {children}
          {action}
        </div>
      </div>
    </div>
  );
}
