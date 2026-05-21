import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { VolumeResponse } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardSubtitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { formatNumber } from '@/lib/utils';

const SEVERITY_ORDER = [
  'FATAL',
  'ERROR',
  'WARN',
  'INFO',
  'TRACE_CONTINUATION',
  'UNCLASSIFIED',
] as const;

const SEVERITY_COLOR: Record<string, string> = {
  FATAL: '#e11d48',
  ERROR: '#ef4444',
  WARN: '#f59e0b',
  INFO: '#3b82f6',
  TRACE_CONTINUATION: '#8b5cf6',
  UNCLASSIFIED: '#6b7280',
};

interface Props {
  data: VolumeResponse | null;
  loading: boolean;
}

export function LogVolumeChart({ data, loading }: Props) {
  const series = useMemo(() => {
    if (!data) return [];
    return data.series.map((p) => ({
      ...p,
      bucket: p.bucket,
      ts: new Date(p.bucket).getTime(),
    }));
  }, [data]);

  const bucketLabel = useMemo(() => {
    if (!data) return '';
    const sec = data.bucket_seconds;
    if (sec >= 86400) return 'per day';
    if (sec >= 3600) return 'per hour';
    return 'per minute';
  }, [data]);

  const fmtX = (ts: number) => {
    const d = new Date(ts);
    if (!data) return '';
    if (data.bucket_seconds >= 86400) {
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    if (data.bucket_seconds >= 3600) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Log volume</CardTitle>
          <CardSubtitle>Stacked by severity, {bucketLabel || 'auto bucket'}</CardSubtitle>
        </div>
        {loading && <Spinner className="text-zinc-500" />}
      </CardHeader>
      <div className="px-2 pt-2 pb-4">
        <div className="h-[300px] w-full">
          {series.length === 0 && !loading ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer>
              <AreaChart
                data={series}
                margin={{ top: 8, right: 24, bottom: 0, left: 8 }}
              >
                <defs>
                  {SEVERITY_ORDER.map((s) => (
                    <linearGradient
                      key={s}
                      id={`fill-${s}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor={SEVERITY_COLOR[s]}
                        stopOpacity={0.55}
                      />
                      <stop
                        offset="100%"
                        stopColor={SEVERITY_COLOR[s]}
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#1f2538"
                />
                <XAxis
                  dataKey="ts"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={fmtX}
                  stroke="#52525b"
                  tick={{ fontSize: 11, fill: '#a1a1aa' }}
                  axisLine={{ stroke: '#1f2538' }}
                  tickLine={false}
                />
                <YAxis
                  stroke="#52525b"
                  tick={{ fontSize: 11, fill: '#a1a1aa' }}
                  axisLine={{ stroke: '#1f2538' }}
                  tickLine={false}
                  tickFormatter={(v) => formatNumber(v)}
                  width={56}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f1320',
                    border: '1px solid #1f2538',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(v) => new Date(v as number).toISOString().slice(0, 19).replace('T', ' ')}
                  formatter={(value: any, name: any) => [formatNumber(value), name]}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={28}
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }}
                />
                {SEVERITY_ORDER.map((s) => (
                  <Area
                    key={s}
                    type="monotone"
                    dataKey={s}
                    name={s === 'TRACE_CONTINUATION' ? 'TRACE' : s}
                    stackId="1"
                    stroke={SEVERITY_COLOR[s]}
                    strokeWidth={1.4}
                    fill={`url(#fill-${s})`}
                    isAnimationActive={false}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-zinc-500">
      No log volume in the selected window.
    </div>
  );
}
