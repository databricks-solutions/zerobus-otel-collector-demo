import { CalendarDays } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import {
  TIME_RANGES,
  TimeRangeId,
  isoToLocalDateTime,
  localDateTimeToIso,
  rangeWindow,
} from '@/lib/timeRanges';

interface Props {
  range: TimeRangeId;
  onRangeChange: (id: TimeRangeId) => void;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (iso: string) => void;
  onCustomToChange: (iso: string) => void;
}

export function TimeRangeControl({
  range,
  onRangeChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
}: Props) {
  const isCustom = range === 'custom';

  function toggleCustom() {
    if (isCustom) {
      onRangeChange('1h');
    } else {
      // Seed with the last 1h if the user hasn't set anything yet
      if (!customFrom || !customTo) {
        const seed = rangeWindow('1h');
        onCustomFromChange(seed.from);
        onCustomToChange(seed.to);
      }
      onRangeChange('custom');
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={isCustom ? '__custom__' : range}
        onValueChange={(v) => onRangeChange(v as TimeRangeId)}
        options={TIME_RANGES.map((r) => ({ value: r.id, label: r.label }))}
        triggerClassName={cn(isCustom && 'opacity-50')}
      />

      <button
        type="button"
        onClick={toggleCustom}
        aria-pressed={isCustom}
        className={cn(
          'inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-[12.5px] font-medium transition-all',
          isCustom
            ? 'border-blue-500/40 bg-blue-500/15 text-blue-200 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.15)]'
            : 'border-surface-3 bg-surface-2/60 text-zinc-300 hover:bg-surface-2 hover:text-zinc-100',
        )}
      >
        <CalendarDays size={13} />
        <span>Custom</span>
      </button>

      {isCustom && (
        <div className="flex items-center gap-1.5 panel px-2.5 py-1 h-9">
          <DateTimeInput
            value={isoToLocalDateTime(customFrom)}
            max={isoToLocalDateTime(customTo) || undefined}
            onChange={(local) => onCustomFromChange(localDateTimeToIso(local))}
            label="from"
          />
          <span className="text-zinc-600 text-[11px] mx-0.5">→</span>
          <DateTimeInput
            value={isoToLocalDateTime(customTo)}
            min={isoToLocalDateTime(customFrom) || undefined}
            onChange={(local) => onCustomToChange(localDateTimeToIso(local))}
            label="to"
          />
        </div>
      )}
    </div>
  );
}

function DateTimeInput({
  value,
  onChange,
  min,
  max,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  label: string;
}) {
  return (
    <input
      type="datetime-local"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value)}
      aria-label={`Custom ${label} datetime`}
      className="bg-transparent text-[12px] text-zinc-200 mono px-1 py-0.5 rounded
                 border border-transparent hover:border-surface-3/70
                 focus:outline-none focus:border-blue-500/40
                 [color-scheme:dark]"
    />
  );
}
