import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'dark';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:outline-blue-600',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:outline-emerald-600',
  dark: 'bg-gray-900 text-white hover:bg-gray-700 focus-visible:outline-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600',
  secondary:
    'bg-white text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:outline-gray-400 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-600 dark:hover:bg-gray-700',
};

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_STYLES[variant]} ${className}`}
      {...props}
    />
  );
}

const CONTROL =
  'block rounded-lg border-0 px-2.5 py-1.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-600';

// Full width unless the caller sets a width (two width classes would fight).
function width(className: string) {
  return /(^|\s)w-/.test(className) ? '' : 'w-full';
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${CONTROL} ${width(className)} ${className}`} {...props} />;
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${CONTROL} pr-8 ${width(className)} ${className}`} {...props} />;
}

export function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-gray-600 dark:text-gray-300">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  id,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className="rounded-lg border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-gray-700">
        <div>
          <h2 id={id ? `${id}-title` : undefined} className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      <div className="px-4 py-4 sm:px-6">{children}</div>
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="text-sm text-gray-500 dark:text-gray-400">{children}</p>;
}

export function Table({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
        <thead>
          <tr className="text-left text-gray-500 dark:text-gray-400">{head}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">{children}</tbody>
      </table>
    </div>
  );
}

export function Th({ children, align = 'left' }: { children?: ReactNode; align?: 'left' | 'right' }) {
  return <th className={`py-2 pr-4 font-medium ${align === 'right' ? 'text-right' : ''}`}>{children}</th>;
}
