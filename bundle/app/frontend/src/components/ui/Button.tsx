import * as React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'ghost' | 'outline' | 'subtle' | 'primary';
type Size = 'sm' | 'md' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantStyles: Record<Variant, string> = {
  default:
    'bg-surface-2 text-zinc-100 hover:bg-surface-3 border border-surface-3 ' +
    'dark:bg-surface-2 dark:text-zinc-100 ' +
    'light:bg-zinc-100',
  ghost:
    'bg-transparent text-zinc-300 hover:bg-surface-2 hover:text-zinc-100 ' +
    'border border-transparent',
  outline:
    'bg-transparent text-zinc-200 hover:bg-surface-2 border border-surface-3',
  subtle:
    'bg-surface-2/60 text-zinc-200 hover:bg-surface-2 border border-surface-3/70',
  primary:
    'bg-blue-600 text-white hover:bg-blue-500 border border-blue-500/40 shadow-sm',
};

const sizeStyles: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-[12px] rounded-md',
  md: 'h-9 px-3 text-[13px] rounded-md',
  icon: 'h-9 w-9 rounded-md',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 font-medium ' +
            'transition-colors disabled:pointer-events-none disabled:opacity-50 ' +
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40',
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
