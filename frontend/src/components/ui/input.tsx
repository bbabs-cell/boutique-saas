import { InputHTMLAttributes, LabelHTMLAttributes, forwardRef } from 'react';

export const Label = ({ className = '', ...props }: LabelHTMLAttributes<HTMLLabelElement>) => (
  <label
    className={`mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300 ${className}`}
    {...props}
  />
);

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className = '', ...props }, ref) => (
    <div>
      <input
        ref={ref}
        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:bg-surface-dark dark:text-zinc-100 ${
          error ? 'border-red-400' : 'border-border-light dark:border-border-dark'
        } ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  ),
);
Input.displayName = 'Input';
