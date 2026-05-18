import { Server } from 'lucide-react';
import { Card, CardContent, CardHeader, CardSubtitle, CardTitle } from '@/components/ui/Card';
import { InfoHint } from '@/components/ui/InfoHint';
import type { NodeUtilizationRow } from '@/lib/api';
import { cn, formatBytes, formatCores } from '@/lib/utils';

interface Props {
  rows: NodeUtilizationRow[];
  loading: boolean;
}

function pct(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'string' ? Number(v) : v;
  return isFinite(n) ? n : 0;
}

function barColor(p: number): string {
  if (p > 90) return 'bg-red-500/80';
  if (p > 75) return 'bg-amber-500/80';
  if (p > 40) return 'bg-emerald-500/80';
  if (p > 10) return 'bg-blue-500/70';
  return 'bg-zinc-600/70';
}

export function NodeUtilizationPanel({ rows, loading }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <Server size={14} className="text-blue-400" />
          <div>
            <CardTitle className="flex items-center gap-1.5">
              <span>Node utilization</span>
              <InfoHint side="bottom">
                For each node, the inner bar is actual p95 usage and the faint outline is
                what pods scheduled to this node have requested. A large gap between the
                two means scheduling headroom is being held back by oversized requests.
              </InfoHint>
            </CardTitle>
            <CardSubtitle>
              Requested vs p95 actual usage as % of estimated capacity
            </CardSubtitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn('space-y-3.5', loading && 'opacity-60 animate-pulse-soft')}>
        {rows.length === 0 && !loading && (
          <div className="text-[13px] text-zinc-500 italic">No node data available.</div>
        )}
        {rows.map((r) => {
          const cpuReqPct = pct(r.cpu_request_pct_of_capacity);
          const cpuUsePct = pct(r.cpu_usage_pct_of_capacity);
          const memReqPct = pct(r.memory_request_pct_of_capacity);
          const memUsePct = pct(r.memory_usage_pct_of_capacity);
          return (
            <div key={r.node} className="space-y-2 pb-3 border-b border-surface-3/40 last:border-0 last:pb-0">
              <div className="flex items-center justify-between">
                <div className="font-mono text-[12px] text-zinc-200 truncate">{r.node}</div>
                <div className="text-[11px] text-zinc-500">
                  {r.pod_count} pods · {formatCores(r.cpu_capacity_cores ?? 0)} cores ·{' '}
                  {formatBytes(r.memory_capacity_bytes_estimate ?? 0)}
                </div>
              </div>

              {/* CPU bar */}
              <div className="space-y-0.5">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>CPU</span>
                  <span className="mono">
                    req {cpuReqPct.toFixed(0)}% · used {cpuUsePct.toFixed(0)}%
                  </span>
                </div>
                <div className="relative h-2 rounded-full bg-surface-3/50 overflow-hidden">
                  {/* request shadow */}
                  <div
                    className="absolute h-full bg-blue-400/15 border-r border-blue-400/30"
                    style={{ width: `${Math.min(cpuReqPct, 100)}%` }}
                  />
                  {/* usage bar */}
                  <div
                    className={cn('absolute h-full', barColor(cpuUsePct))}
                    style={{ width: `${Math.min(cpuUsePct, 100)}%` }}
                  />
                </div>
              </div>

              {/* Memory bar */}
              <div className="space-y-0.5">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Memory</span>
                  <span className="mono">
                    req {memReqPct.toFixed(0)}% · used {memUsePct.toFixed(0)}%
                  </span>
                </div>
                <div className="relative h-2 rounded-full bg-surface-3/50 overflow-hidden">
                  <div
                    className="absolute h-full bg-violet-400/15 border-r border-violet-400/30"
                    style={{ width: `${Math.min(memReqPct, 100)}%` }}
                  />
                  <div
                    className={cn('absolute h-full', barColor(memUsePct))}
                    style={{ width: `${Math.min(memUsePct, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
