import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-md border border-surface-3 bg-surface-2/60 px-3 ' +
          'text-[13px] text-zinc-100 placeholder:text-zinc-500 ' +
          'focus:outline-none focus:ring-2 focus:ring-blue-500/40',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'w-full rounded-md border border-surface-3 bg-surface-2/60 px-3 py-2 ' +
        'text-[13px] text-zinc-100 placeholder:text-zinc-500 resize-none ' +
        'focus:outline-none focus:ring-2 focus:ring-blue-500/40',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';
