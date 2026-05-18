import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { ErrorRow } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardSubtitle } from '@/components/ui/Card';
import { SeverityBadge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { cn, formatTimestamp } from '@/lib/utils';

interface Props {
  rows: ErrorRow[];
  loading: boolean;
}

export function RecentErrorsPanel({ rows, loading }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <Card className="overflow-hidden flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>Recent errors</CardTitle>
          <CardSubtitle>Latest from logs_errors (ERROR / WARN / FATAL)</CardSubtitle>
        </div>
        {loading && <Spinner className="text-zinc-500" />}
      </CardHeader>

      <div className="flex-1 overflow-auto max-h-[480px]">
        {rows.length === 0 && !loading ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            No errors in the current selection.
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-surface-1/95 backdrop-blur z-10">
              <tr className="text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-2 font-medium w-[44px]"></th>
                <th className="px-2 py-2 font-medium w-[170px]">Time</th>
                <th className="px-2 py-2 font-medium w-[80px]">Severity</th>
                <th className="px-2 py-2 font-medium w-[140px]">Namespace</th>
                <th className="px-2 py-2 font-medium w-[200px]">Pod</th>
                <th className="px-2 py-2 font-medium">Message</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const isOpen = expanded === idx;
                return (
                  <tr
                    key={idx}
                    onClick={() => setExpanded(isOpen ? null : idx)}
                    className={cn(
                      'border-t border-surface-3/40 cursor-pointer',
                      'hover:bg-surface-2/40 transition-colors animate-fade-in',
                      isOpen && 'bg-surface-2/40',
                    )}
                  >
                    <td className="px-4 py-2 align-top text-zinc-500">
                      <ChevronRight
                        size={14}
                        className={cn(
                          'transition-transform duration-150',
                          isOpen && 'rotate-90',
                        )}
                      />
                    </td>
                    <td className="px-2 py-2 align-top mono text-zinc-400 whitespace-nowrap">
                      {formatTimestamp(r.log_timestamp)}
                    </td>
                    <td className="px-2 py-2 align-top">
                      <SeverityBadge severity={r.parsed_severity} />
                    </td>
                    <td className="px-2 py-2 align-top mono text-zinc-300">
                      {r.namespace || '—'}
                    </td>
                    <td className="px-2 py-2 align-top mono text-zinc-300 truncate max-w-[200px]">
                      <div className="truncate">{r.pod || '—'}</div>
                      {r.container && (
                        <div className="text-[11px] text-zinc-500 truncate">
                          {r.container}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2 align-top text-zinc-200 mono pr-4">
                      <div
                        className={cn(
                          isOpen ? 'whitespace-pre-wrap break-all' : 'truncate',
                          'max-w-[640px]',
                        )}
                      >
                        {r.body || ''}
                      </div>
                      {isOpen && (
                        <div className="mt-2 text-[11px] text-zinc-500 flex flex-wrap gap-x-4 gap-y-1">
                          {r.deployment && <span>deploy: {r.deployment}</span>}
                          {r.service && <span>svc: {r.service}</span>}
                          {r.node && <span>node: {r.node}</span>}
                          {r.trace_id && <span>trace: {r.trace_id}</span>}
                          {r.span_id && <span>span: {r.span_id}</span>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
