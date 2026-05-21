import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  children: React.ReactNode;
  /** Position of the popover relative to the icon. */
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  iconClassName?: string;
}

/**
 * Small inline (i) icon that reveals a popover on hover/focus. Uses CSS only —
 * no JS or Radix dependency. Intentionally lightweight for inline help text.
 */
export function InfoHint({
  children,
  side = 'top',
  className,
  iconClassName,
}: Props) {
  const positions: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <span className={cn('relative inline-flex group', className)}>
      <button
        type="button"
        tabIndex={0}
        aria-label="More information"
        className={cn(
          'inline-flex items-center justify-center rounded-full',
          'text-zinc-500 hover:text-zinc-300 focus:text-zinc-200',
          'focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/40',
          'transition-colors',
          iconClassName,
        )}
      >
        <Info size={11.5} />
      </button>
      <span
        role="tooltip"
        className={cn(
          'absolute z-30 w-60 max-w-[calc(100vw-2rem)] px-3 py-2 rounded-lg',
          'border border-surface-3/80 bg-surface-1/95 backdrop-blur',
          'text-[11.5px] leading-relaxed text-zinc-300 font-normal normal-case tracking-normal',
          'shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]',
          'opacity-0 pointer-events-none translate-y-0.5',
          'group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100',
          'transition-all duration-150',
          positions[side],
        )}
      >
        {children}
      </span>
    </span>
  );
}
