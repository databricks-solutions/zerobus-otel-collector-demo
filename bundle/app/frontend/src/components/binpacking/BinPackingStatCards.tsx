import { Cpu, MemoryStick, PackageX, Recycle } from 'lucide-react';
import type { BinPackingSummary } from '@/lib/api';
import { cn, formatBytes, formatCores } from '@/lib/utils';
import { InfoHint } from '@/components/ui/InfoHint';

interface Props {
  summary: BinPackingSummary | null;
  loading: boolean;
}

export function BinPackingStatCards({ summary, loading }: Props) {
  const cpuWastePct = summary?.cpu_waste_pct ?? null;
  const memWastePct = summary?.memory_waste_pct ?? null;

  const cards = [
    {
      label: 'CPU waste',
      hint: 'Share of requested CPU that pods didn\'t actually use at the 95th percentile during the selected window. High values mean over-provisioned workloads.',
      value:
        summary && summary.cpu_requested_cores > 0
          ? `${cpuWastePct?.toFixed(1) ?? '—'}%`
          : '—',
      sub:
        summary && summary.cpu_requested_cores > 0
          ? `${formatCores(summary.cpu_waste_cores)} / ${formatCores(
              summary.cpu_requested_cores,
            )} cores`
          : 'no data',
      icon: <Cpu size={14} className="text-blue-400" />,
      tone:
        cpuWastePct != null && cpuWastePct > 60
          ? 'text-red-400'
          : cpuWastePct != null && cpuWastePct > 30
            ? 'text-amber-400'
            : 'text-emerald-400',
    },
    {
      label: 'Memory waste',
      hint: 'Share of requested memory pods didn\'t actually use at p95. Memory waste is usually safer to reclaim than CPU since the kernel handles bursts better.',
      value:
        summary && summary.memory_requested_bytes > 0
          ? `${memWastePct?.toFixed(1) ?? '—'}%`
          : '—',
      sub:
        summary && summary.memory_requested_bytes > 0
          ? `${formatBytes(summary.memory_waste_bytes)} / ${formatBytes(
              summary.memory_requested_bytes,
            )}`
          : 'no data',
      icon: <MemoryStick size={14} className="text-violet-400" />,
      tone:
        memWastePct != null && memWastePct > 60
          ? 'text-red-400'
          : memWastePct != null && memWastePct > 30
            ? 'text-amber-400'
            : 'text-emerald-400',
    },
    {
      label: 'Over-provisioned pods',
      hint: 'Pods using less than 25% of either their CPU or memory request. Strong rightsizing candidates.',
      value: summary
        ? String(
            Math.max(summary.over_provisioned_cpu_count, summary.over_provisioned_mem_count),
          )
        : '—',
      sub: summary
        ? `${summary.over_provisioned_cpu_count} CPU · ${summary.over_provisioned_mem_count} mem`
        : '',
      icon: <PackageX size={14} className="text-amber-400" />,
      tone: 'text-amber-400',
    },
    {
      label: 'Pods analyzed',
      hint: 'Pods with both a resource spec (request/limit) and observed usage in the window. Pods missing either are excluded.',
      value: summary ? String(summary.pod_count) : '—',
      sub: summary?.pod_count
        ? 'with cpu & mem requests'
        : 'no spec data',
      icon: <Recycle size={14} className="text-emerald-400" />,
      tone: 'text-emerald-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="stat-card">
          <div className="flex items-center justify-between">
            <div className="stat-label flex items-center gap-1.5">
              <span>{c.label}</span>
              <InfoHint side="bottom">{c.hint}</InfoHint>
            </div>
            <div>{c.icon}</div>
          </div>
          <div className={cn('stat-value', loading && 'opacity-60 animate-pulse-soft', c.tone)}>
            {c.value}
          </div>
          <div className="stat-sub">{c.sub || ' '}</div>
        </div>
      ))}
    </div>
  );
}
