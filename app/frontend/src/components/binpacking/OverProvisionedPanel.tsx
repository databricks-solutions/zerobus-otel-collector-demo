import { TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardSubtitle, CardTitle } from '@/components/ui/Card';
import { InfoHint } from '@/components/ui/InfoHint';
import type { OverProvisionedRow } from '@/lib/api';
import { cn, formatBytes, formatCores } from '@/lib/utils';

interface Props {
  title: string;
  subtitle: string;
  rows: OverProvisionedRow[];
  resource: 'cpu' | 'memory';
  loading: boolean;
}

function pct(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === 'string' ? Number(v) : v;
  return isFinite(n) ? n : null;
}

function effTone(p: number | null): string {
  if (p == null) return 'text-zinc-500';
  if (p < 10) return 'text-red-400';
  if (p < 25) return 'text-amber-400';
  if (p < 60) return 'text-blue-300';
  return 'text-emerald-400';
}

function fmt(v: string | number | null | undefined, resource: 'cpu' | 'memory'): string {
  if (v == null || v === '') return '—';
  return resource === 'cpu' ? formatCores(v) : formatBytes(v);
}

export function OverProvisionedPanel({ title, subtitle, rows, resource, loading }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <TrendingDown size={14} className="text-amber-400" />
          <div>
            <CardTitle className="flex items-center gap-1.5">
              <span>{title}</span>
              <InfoHint side="bottom">
                Pods sorted by absolute waste — the difference between what they
                requested and what they actually used at the 95th percentile. The
                <span className="text-zinc-200"> Eff. </span>column shows used ÷ requested:
                lower is more wasteful. Reduce requests to match observed usage to free
                cluster capacity.
              </InfoHint>
            </CardTitle>
            <CardSubtitle>{subtitle}</CardSubtitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn(loading && 'opacity-60 animate-pulse-soft', 'p-0')}>
        {rows.length === 0 && !loading && (
          <div className="px-5 py-4 text-[13px] text-zinc-500 italic">
            No over-provisioned pods found.
          </div>
        )}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="text-[10.5px] uppercase tracking-wider text-zinc-500 border-b border-surface-3/60">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Pod</th>
                  <th className="text-right px-4 py-2 font-medium">Request</th>
                  <th className="text-right px-4 py-2 font-medium">Used p95</th>
                  <th className="text-right px-4 py-2 font-medium">Waste</th>
                  <th className="text-right px-4 py-2 font-medium">Eff.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const eff = pct(r.efficiency_pct);
                  return (
                    <tr
                      key={`${r.namespace}/${r.pod}`}
                      className="border-b border-surface-3/30 last:border-0 hover:bg-surface-2/40"
                    >
                      <td className="px-4 py-2.5 align-top">
                        <div className="font-mono text-zinc-200 truncate max-w-[280px]">
                          {r.pod}
                        </div>
                        <div className="text-[10.5px] text-zinc-500 truncate max-w-[280px]">
                          {r.namespace}
                          {r.deployment ? ` · ${r.deployment}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right mono text-zinc-300">
                        {fmt(r.request, resource)}
                      </td>
                      <td className="px-4 py-2.5 text-right mono text-zinc-300">
                        {fmt(r.used_p95, resource)}
                      </td>
                      <td className="px-4 py-2.5 text-right mono text-amber-300">
                        {fmt(r.waste, resource)}
                      </td>
                      <td className={cn('px-4 py-2.5 text-right mono font-medium', effTone(eff))}>
                        {eff != null ? `${eff.toFixed(0)}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
