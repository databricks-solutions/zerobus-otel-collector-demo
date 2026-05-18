import * as React from 'react';
import { cn } from '@/lib/utils';
import type { Severity } from '@/lib/api';

const severityClass: Record<string, string> = {
  FATAL: 'badge-fatal',
  ERROR: 'badge-error',
  WARN: 'badge-warn',
  INFO: 'badge-info',
  TRACE_CONTINUATION: 'badge-trace',
  UNCLASSIFIED: 'badge-unclassified',
};

export function SeverityBadge({
  severity,
  className,
}: {
  severity: Severity | string | null | undefined;
  className?: string;
}) {
  const sev = (severity || 'UNCLASSIFIED').toUpperCase();
  const cls = severityClass[sev] || 'badge-unclassified';
  const label = sev === 'TRACE_CONTINUATION' ? 'TRACE' : sev;
  return <span className={cn('badge', cls, className)}>{label}</span>;
}

export function Pill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-surface-3/70 ' +
          'bg-surface-2/60 px-1.5 py-0.5 text-[11px] text-zinc-300',
        className,
      )}
    >
      {children}
    </span>
  );
}
