import { ButtonHTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center rounded-xl font-medium transition-all',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
        {
          'bg-teal-500 text-white hover:bg-teal-600 focus:ring-teal-500 active:scale-[0.98]':
            variant === 'primary' && !disabled,
          'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-400':
            variant === 'secondary' && !disabled,
          'border-2 border-teal-500 text-teal-600 hover:bg-teal-50 focus:ring-teal-500':
            variant === 'outline' && !disabled,
          'text-gray-700 hover:bg-gray-100 focus:ring-gray-400':
            variant === 'ghost' && !disabled,
          'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500':
            variant === 'danger' && !disabled,
          'px-3 py-2 text-sm': size === 'sm',
          'px-4 py-3 text-base': size === 'md',
          'px-6 py-4 text-lg': size === 'lg',
          'w-full': fullWidth,
        },
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
