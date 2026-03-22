import { ButtonHTMLAttributes, ReactNode, useState } from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  loadingText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = true,
  loading = false,
  loadingText = 'Processing...',
  leftIcon,
  rightIcon,
  className,
  children,
  disabled,
  onClick,
  ...props
}: ButtonProps) {
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number; size: number }>>([]);
  const isDisabled = disabled || loading;

  const handleClick: ButtonHTMLAttributes<HTMLButtonElement>['onClick'] = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    const id = Date.now() + Math.random();

    setRipples((prev) => [...prev, { id, x, y, size }]);
    window.setTimeout(() => {
      setRipples((prev) => prev.filter((item) => item.id !== id));
    }, 520);

    onClick?.(event);
  };

  return (
    <button
      className={clsx(
        'relative inline-flex min-h-12 items-center justify-center gap-2 overflow-hidden rounded-xl font-medium',
        'transition-all duration-200 active:scale-95 active:shadow-inner',
        'hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
        {
          'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg focus:ring-blue-500':
            variant === 'primary' && !disabled,
          'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-400':
            variant === 'secondary' && !disabled,
          'border-2 border-teal-500 text-teal-600 hover:bg-teal-50 focus:ring-teal-500':
            variant === 'outline' && !disabled,
          'text-gray-700 hover:bg-gray-100 focus:ring-gray-400':
            variant === 'ghost' && !disabled,
          'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500':
            variant === 'danger' && !disabled,
          'bg-green-500 text-white hover:bg-green-600 focus:ring-green-500':
            variant === 'success' && !disabled,
          'px-3 py-2 text-sm': size === 'sm',
          'px-4 py-3 text-sm md:text-base': size === 'md',
          'px-6 py-4 text-base md:text-lg': size === 'lg',
          'w-full': fullWidth,
        },
        className
      )}
      disabled={isDisabled}
      onClick={handleClick}
      {...props}
    >
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="btn-ripple-circle"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
          }}
        />
      ))}
      {loading ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>{loadingText}</span>
        </>
      ) : (
        <>
          {leftIcon ? <span className="inline-flex items-center">{leftIcon}</span> : null}
          <span>{children}</span>
          {rightIcon ? <span className="inline-flex items-center">{rightIcon}</span> : null}
        </>
      )}
    </button>
  );
}
