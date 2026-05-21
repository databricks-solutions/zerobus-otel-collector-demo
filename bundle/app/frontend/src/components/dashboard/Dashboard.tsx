import { useCallback, useEffect, useState } from 'react';
import {
  api,
  type ErrorRow,
  type NoisyPodRow,
  type Summary,
  type VolumeResponse,
} from '@/lib/api';
import { rangeWindow, type TimeRangeId } from '@/lib/timeRanges';
import { FilterBar } from './FilterBar';
import { StatCards } from './StatCards';
import { LogVolumeChart } from './LogVolumeChart';
import { RecentErrorsPanel } from './RecentErrorsPanel';
import { NoisyPodsPanel } from './NoisyPodsPanel';
import { Card, CardContent } from '@/components/ui/Card';
import { AlertCircle, Activity } from 'lucide-react';
import { PageHero } from '@/components/ui/PageHero';

export function Dashboard() {
  const [range, setRange] = useState<TimeRangeId>('1h');
  // Custom range state — initialized lazily when user picks "Custom range…"
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [namespace, setNamespace] = useState<string>('');
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [volume, setVolume] = useState<VolumeResponse | null>(null);
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [noisy, setNoisy] = useState<NoisyPodRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    // Don't fire requests with a half-filled custom range
    if (range === 'custom' && (!customFrom || !customTo)) return;
    setLoading(true);
    setError(null);
    try {
      const win = rangeWindow(range, { from: customFrom, to: customTo });
      const [summaryR, volumeR, errorsR, noisyR] = await Promise.all([
        api.summary(win.from, win.to, namespace || undefined),
        api.logVolume(win.from, win.to, namespace || undefined),
        api.recentErrors(50, namespace || undefined),
        api.noisyPods(win.from, win.to, 20, namespace || undefined),
      ]);
      setSummary(summaryR);
      setVolume(volumeR);
      setErrors(errorsR.rows);
      setNoisy(noisyR.rows);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [range, customFrom, customTo, namespace]);

  useEffect(() => {
    api
      .namespaces()
      .then((r) => setNamespaces(r.namespaces))
      .catch(() => {
        /* dropdown can stay empty if this fails; main load reports the error */
      });
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return (
    <div className="space-y-4">
      <PageHero
        icon={<Activity size={16} className="text-blue-300" />}
        title="Logs & errors"
        subtitle="Real-time activity from your Kubernetes telemetry — log volume by severity, error trends, and the noisiest pods over the selected window."
        description={
          <>
            Use the time range and namespace filters to drill in, or open the chatbot
            in the corner to ask questions in plain English.
          </>
        }
      />

      <FilterBar
        range={range}
        onRangeChange={setRange}
        customFrom={customFrom}
        customTo={customTo}
        onCustomFromChange={setCustomFrom}
        onCustomToChange={setCustomTo}
        namespace={namespace}
        onNamespaceChange={setNamespace}
        namespaces={namespaces}
        onRefresh={loadAll}
        loading={loading}
      />

      {error && (
        <Card>
          <CardContent>
            <div className="flex items-start gap-2 text-sm text-red-300">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-medium">Failed to load dashboard data.</div>
                <div className="mono text-[12px] text-red-200/70 break-all">
                  {error}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <StatCards summary={summary} loading={loading} />

      <LogVolumeChart data={volume} loading={loading} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <RecentErrorsPanel rows={errors} loading={loading} />
        <NoisyPodsPanel rows={noisy} loading={loading} />
      </div>
    </div>
  );
}
