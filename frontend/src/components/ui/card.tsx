import { HTMLAttributes, SelectHTMLAttributes, forwardRef } from 'react';

export const Card = ({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={`rounded-xl border border-border-light bg-surface-light shadow-sm dark:border-border-dark dark:bg-surface-dark ${className}`}
    {...props}
  />
);

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, className = '', children, ...props }, ref) => (
    <div>
      <select
        ref={ref}
        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:bg-surface-dark dark:text-zinc-100 ${
          error ? 'border-red-400' : 'border-border-light dark:border-border-dark'
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  ),
);
Select.displayName = 'Select';
