import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { TimeRangeControl } from '@/components/ui/TimeRangeControl';
import { TimeRangeId } from '@/lib/timeRanges';

interface Props {
  range: TimeRangeId;
  onRangeChange: (id: TimeRangeId) => void;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (iso: string) => void;
  onCustomToChange: (iso: string) => void;
  namespace: string;
  onNamespaceChange: (ns: string) => void;
  namespaces: string[];
  onRefresh: () => void;
  loading: boolean;
}

export function FilterBar({
  range,
  onRangeChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  namespace,
  onNamespaceChange,
  namespaces,
  onRefresh,
  loading,
}: Props) {
  const nsOptions = [
    { value: '__all__', label: 'All namespaces' },
    ...namespaces.map((n) => ({ value: n, label: n })),
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <TimeRangeControl
        range={range}
        onRangeChange={onRangeChange}
        customFrom={customFrom}
        customTo={customTo}
        onCustomFromChange={onCustomFromChange}
        onCustomToChange={onCustomToChange}
      />
      <Select
        value={namespace || '__all__'}
        onValueChange={(v) => onNamespaceChange(v === '__all__' ? '' : v)}
        options={nsOptions}
        triggerClassName="min-w-[200px]"
      />
      <div className="flex-1" />
      <Button variant="subtle" onClick={onRefresh} disabled={loading}>
        {loading ? <Spinner /> : <RefreshCw size={14} />}
        <span>Refresh</span>
      </Button>
    </div>
  );
}
