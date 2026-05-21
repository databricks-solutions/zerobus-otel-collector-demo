import * as React from 'react';
import { cn } from '@/lib/utils';

interface Props {
  icon?: React.ReactNode;
  /** Short title — appears at top, large weight. */
  title: string;
  /** One-line lead under the title. */
  subtitle?: string;
  /** Optional longer paragraph for context. */
  description?: React.ReactNode;
  /** Right-aligned action area (buttons, links, badges). */
  actions?: React.ReactNode;
  className?: string;
}

export function PageHero({
  icon,
  title,
  subtitle,
  description,
  actions,
  className,
}: Props) {
  return (
    <div className={cn('flex items-start justify-between gap-4 mb-1', className)}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5
                          border border-surface-3/70 bg-surface-2/60">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-[18px] font-semibold tracking-tight text-zinc-100 leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[13px] text-zinc-400 mt-1 leading-relaxed max-w-2xl">
              {subtitle}
            </p>
          )}
          {description && (
            <div className="text-[12.5px] text-zinc-500 mt-1.5 leading-relaxed max-w-2xl">
              {description}
            </div>
          )}
        </div>
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
}
