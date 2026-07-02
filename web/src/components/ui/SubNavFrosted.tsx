import { ReactNode } from 'react';

interface Props {
  title: string;
  lead?: string;
  children?: ReactNode;
  action?: ReactNode;
}

export function SubNavFrosted({ title, lead, children, action }: Props) {
  return (
    <div className="sub-nav-frosted">
      <div className="mx-auto flex h-full max-w-[1440px] flex-wrap items-center justify-between gap-4 px-6 py-3">
        <div className="min-w-0">
          <p className="section-eyebrow mb-1 text-[10px]">CiVX</p>
          <h1 className="text-[21px] font-semibold tracking-[-0.01em] text-ink">{title}</h1>
          {lead && <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-muted-48">{lead}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {children}
          {action}
        </div>
      </div>
    </div>
  );
}
