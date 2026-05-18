import { Combine } from 'lucide-react';
import { Card, CardContent, CardHeader, CardSubtitle, CardTitle } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Badge';
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

export function ConsolidationPanel({ rows, loading }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <Combine size={14} className="text-emerald-400" />
          <div>
            <CardTitle className="flex items-center gap-1.5">
              <span>Consolidation candidates</span>
              <InfoHint side="bottom">
                Nodes whose 95th-percentile CPU stayed below 40% and memory below 50% during
                the window. Workloads on these nodes could likely be drained and rescheduled
                onto remaining nodes to reduce node count and infra cost.
              </InfoHint>
            </CardTitle>
            <CardSubtitle>
              Nodes below 40% CPU and 50% memory at p95 — workloads here could likely be packed onto fewer nodes
            </CardSubtitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn(loading && 'opacity-60 animate-pulse-soft', 'space-y-3')}>
        {rows.length === 0 && !loading && (
          <div className="text-[13px] text-zinc-500 italic">
            No consolidation candidates — your nodes are well-utilized.
          </div>
        )}
        {rows.map((r) => {
          const cpuUse = pct(r.cpu_usage_pct_of_capacity);
          const memUse = pct(r.memory_usage_pct_of_capacity);
          const cpuReq = pct(r.cpu_request_pct_of_capacity);
          const memReq = pct(r.memory_request_pct_of_capacity);
          return (
            <div
              key={r.node}
              className="rounded-md border border-emerald-500/15 bg-emerald-500/[0.04] p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="font-mono text-[12px] text-zinc-100 truncate">{r.node}</div>
                <Pill className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                  {r.pod_count} pods
                </Pill>
              </div>
              <div className="grid grid-cols-2 gap-3 text-[11.5px]">
                <div>
                  <div className="text-zinc-500 mb-0.5">CPU</div>
                  <div className="mono text-zinc-200">
                    using {formatCores(r.cpu_used_p95_cores ?? 0)} / {formatCores(r.cpu_capacity_cores ?? 0)}
                  </div>
                  <div className="text-zinc-500">
                    {cpuUse.toFixed(0)}% used · {cpuReq.toFixed(0)}% requested
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500 mb-0.5">Memory</div>
                  <div className="mono text-zinc-200">
                    using {formatBytes(r.memory_used_p95_bytes ?? 0)} /{' '}
                    {formatBytes(r.memory_capacity_bytes_estimate ?? 0)}
                  </div>
                  <div className="text-zinc-500">
                    {memUse.toFixed(0)}% used · {memReq.toFixed(0)}% requested
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
