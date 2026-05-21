import { useMemo } from 'react';
import type { NoisyPodRow } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardSubtitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Props {
  rows: NoisyPodRow[];
  loading: boolean;
}

export function NoisyPodsPanel({ rows, loading }: Props) {
  const max = useMemo(() => Math.max(1, ...rows.map((r) => r.total)), [rows]);

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader>
        <div>
          <CardTitle>Top noisy pods</CardTitle>
          <CardSubtitle>Highest log volume in the selected window</CardSubtitle>
        </div>
        {loading && <Spinner className="text-zinc-500" />}
      </CardHeader>
      <div className="flex-1 overflow-auto max-h-[480px]">
        {rows.length === 0 && !loading ? (
          <div className="p-8 text-center text-sm text-zinc-500">No data.</div>
        ) : (
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-surface-1/95 backdrop-blur z-10">
              <tr className="text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-2 font-medium">Pod</th>
                <th className="px-2 py-2 font-medium w-[140px]">Volume</th>
                <th className="px-2 py-2 font-medium w-[80px] text-right">Errors</th>
                <th className="px-2 py-2 font-medium w-[80px] text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pct = (r.total / max) * 100;
                const errorPct = r.total > 0 ? (r.error_count / r.total) * 100 : 0;
                return (
                  <tr
                    key={`${r.namespace}/${r.pod}`}
                    className="border-t border-surface-3/40 hover:bg-surface-2/40"
                  >
                    <td className="px-4 py-2 align-top">
                      <div className="mono text-zinc-200 truncate max-w-[280px]">
                        {r.pod}
                      </div>
                      <div className="text-[11px] text-zinc-500 mono">
                        {r.namespace}
                        {r.service ? ` · ${r.service}` : ''}
                      </div>
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <div className="relative h-2 w-full rounded-full bg-surface-3/60 overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-blue-500/70 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                        {errorPct > 0 && (
                          <div
                            className="absolute inset-y-0 left-0 bg-red-500/80 rounded-full"
                            style={{ width: `${(pct * errorPct) / 100}%` }}
                          />
                        )}
                      </div>
                    </td>
                    <td
                      className={cn(
                        'px-2 py-2 align-middle text-right mono',
                        r.error_count > 0 ? 'text-red-300' : 'text-zinc-500',
                      )}
                    >
                      {formatNumber(r.error_count)}
                    </td>
                    <td className="px-2 py-2 align-middle text-right mono text-zinc-200">
                      {formatNumber(r.total)}
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
