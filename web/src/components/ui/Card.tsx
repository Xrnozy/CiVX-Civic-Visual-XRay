import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Card({ title, children, className = '' }: CardProps) {
  return (
    <div className={`ui-card ${className}`.trim()} data-no-motion>
      {title ? <p className="ui-card-title">{title}</p> : null}
      {children}
    </div>
  );
}
