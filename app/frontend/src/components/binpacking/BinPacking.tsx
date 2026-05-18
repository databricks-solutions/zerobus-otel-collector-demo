import { useEffect, useState } from 'react';
import { Package, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { TimeRangeControl } from '@/components/ui/TimeRangeControl';
import { PageHero } from '@/components/ui/PageHero';
import { rangeWindow, type TimeRangeId } from '@/lib/timeRanges';
import {
  api,
  type BinPackingSummary,
  type NodeUtilizationRow,
  type OverProvisionedRow,
} from '@/lib/api';
import { BinPackingStatCards } from './BinPackingStatCards';
import { NodeUtilizationPanel } from './NodeUtilizationPanel';
import { OverProvisionedPanel } from './OverProvisionedPanel';
import { ConsolidationPanel } from './ConsolidationPanel';

export function BinPacking() {
  const [range, setRange] = useState<TimeRangeId>('24h');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [summary, setSummary] = useState<BinPackingSummary | null>(null);
  const [nodes, setNodes] = useState<NodeUtilizationRow[]>([]);
  const [overProvCpu, setOverProvCpu] = useState<OverProvisionedRow[]>([]);
  const [overProvMem, setOverProvMem] = useState<OverProvisionedRow[]>([]);
  const [consolidation, setConsolidation] = useState<NodeUtilizationRow[]>([]);
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [namespace, setNamespace] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.namespaces().then((r) => setNamespaces(r.namespaces)).catch(() => {});
  }, []);

  async function load() {
    if (range === 'custom' && (!customFrom || !customTo)) return;
    setLoading(true);
    setError(null);
    try {
      const win = rangeWindow(range, { from: customFrom, to: customTo });
      const [s, n, opc, opm, c] = await Promise.all([
        api.binPackingSummary(win.from, win.to, namespace || undefined),
        api.binPackingNodes(win.from, win.to, namespace || undefined),
        api.binPackingOverProvisioned('cpu', win.from, win.to, 10, namespace || undefined),
        api.binPackingOverProvisioned('memory', win.from, win.to, 10, namespace || undefined),
        api.binPackingConsolidation(win.from, win.to, 40, 50),
      ]);
      setSummary(s);
      setNodes(n.rows);
      setOverProvCpu(opc.rows);
      setOverProvMem(opm.rows);
      setConsolidation(c.rows);
    } catch (e: any) {
      setError(e.message || 'Failed to load bin-packing data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, customFrom, customTo, namespace]);

  return (
    <div className="space-y-4">
      <PageHero
        icon={<Package size={16} className="text-amber-300" />}
        title="Bin packing & rightsizing"
        subtitle="Compare what your pods requested against what they actually used at the 95th percentile. Find over-provisioned workloads, identify nodes you could consolidate, and quantify cluster waste."
        description={
          <>
            CPU is measured in cores; memory in bytes. <strong>Efficiency</strong> is
            actual&nbsp;p95 ÷ requested. <strong>Waste</strong> is requested −&nbsp;p95.
            Capacity is estimated from observed peak usage when allocatable metrics
            aren't available.
          </>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <TimeRangeControl
          range={range}
          onRangeChange={setRange}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
        />
        <Select
          value={namespace || '__all__'}
          onValueChange={(v) => setNamespace(v === '__all__' ? '' : v)}
          options={[
            { value: '__all__', label: 'All namespaces' },
            ...namespaces.map((ns) => ({ value: ns, label: ns })),
          ]}
          triggerClassName="min-w-[200px]"
        />
        <div className="flex-1" />
        <Button onClick={load} disabled={loading} variant="subtle">
          {loading ? <Spinner /> : <RefreshCw size={14} />}
          <span>Refresh</span>
        </Button>
      </div>

      {error && (
        <div className="panel border-red-500/40 bg-red-950/30 text-red-300 px-4 py-3 text-[13px]">
          {error}
        </div>
      )}

      <BinPackingStatCards summary={summary} loading={loading} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <NodeUtilizationPanel rows={nodes} loading={loading} />
        <ConsolidationPanel rows={consolidation} loading={loading} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <OverProvisionedPanel
          title="Top CPU over-provisioned pods"
          subtitle="Largest gap between request and p95 actual CPU usage"
          rows={overProvCpu}
          resource="cpu"
          loading={loading}
        />
        <OverProvisionedPanel
          title="Top memory over-provisioned pods"
          subtitle="Largest gap between request and p95 actual memory usage"
          rows={overProvMem}
          resource="memory"
          loading={loading}
        />
      </div>
    </div>
  );
}
