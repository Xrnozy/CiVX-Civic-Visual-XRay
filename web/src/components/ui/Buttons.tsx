import { ButtonHTMLAttributes } from 'react';

export function ButtonPrimary({ children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`btn-primary ${className}`} {...props}>{children}</button>
  );
}

export function ButtonSecondaryPill({ children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`btn-secondary-pill ${className}`} {...props}>{children}</button>
  );
}

export function ButtonDark({ children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`btn-dark-utility ${className}`} {...props}>{children}</button>
  );
}
