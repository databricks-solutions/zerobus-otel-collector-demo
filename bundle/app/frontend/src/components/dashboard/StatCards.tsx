import { Activity, AlertTriangle, Boxes, Percent } from 'lucide-react';
import type { Summary } from '@/lib/api';
import { formatNumber, formatPercent } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { InfoHint } from '@/components/ui/InfoHint';

interface Props {
  summary: Summary | null;
  loading: boolean;
}

export function StatCards({ summary, loading }: Props) {
  const cards = [
    {
      label: 'Total logs',
      hint: 'Total log lines collected from your cluster over the selected time window. Includes all severities.',
      value: summary ? formatNumber(summary.total_logs) : '—',
      icon: <Activity size={14} className="text-blue-400" />,
      sub: summary ? `${summary.distinct_namespaces} namespaces` : '',
      tone: 'text-blue-400',
    },
    {
      label: 'Errors',
      hint: 'Log lines parsed as ERROR or FATAL from the message body across 30+ formats (log4j, klog, JSON, Envoy, etc.). Warnings are tracked separately.',
      value: summary ? formatNumber(summary.error_count) : '—',
      icon: <AlertTriangle size={14} className="text-red-400" />,
      sub: summary ? `${formatNumber(summary.warn_count)} warnings` : '',
      tone: 'text-red-400',
    },
    {
      label: 'Error rate',
      hint: 'Errors as a percentage of all log volume. Over 5% is flagged as elevated — common causes are crash loops, dependency outages, or noisy debug-level logging mis-classified.',
      value: summary ? formatPercent(summary.error_rate) : '—',
      icon: <Percent size={14} className="text-amber-400" />,
      sub: summary && summary.error_rate > 0.05 ? 'elevated' : 'within range',
      tone: summary && summary.error_rate > 0.05 ? 'text-amber-400' : 'text-zinc-400',
    },
    {
      label: 'Active pods',
      hint: 'Distinct pods that emitted at least one log line in the window. Use this to gauge cluster activity and spot pods that suddenly stop logging.',
      value: summary ? formatNumber(summary.distinct_pods) : '—',
      icon: <Boxes size={14} className="text-violet-400" />,
      sub: summary ? `${formatNumber(summary.distinct_services)} services` : '',
      tone: 'text-violet-400',
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
          <div className={cn('stat-value', loading && 'opacity-60 animate-pulse-soft')}>
            {c.value}
          </div>
          <div className="stat-sub">{c.sub || ' '}</div>
        </div>
      ))}
    </div>
  );
}
