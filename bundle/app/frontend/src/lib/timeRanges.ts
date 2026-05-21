export type TimeRangeId = '15m' | '1h' | '6h' | '24h' | '7d' | 'custom';

export interface TimeRange {
  id: TimeRangeId;
  label: string;
  seconds?: number; // undefined for 'custom'
}

// 'custom' is a virtual range driven by separate UI; not in the preset dropdown.
export const TIME_RANGES: TimeRange[] = [
  { id: '15m', label: 'Last 15 minutes', seconds: 15 * 60 },
  { id: '1h', label: 'Last 1 hour', seconds: 60 * 60 },
  { id: '6h', label: 'Last 6 hours', seconds: 6 * 60 * 60 },
  { id: '24h', label: 'Last 24 hours', seconds: 24 * 60 * 60 },
  { id: '7d', label: 'Last 7 days', seconds: 7 * 24 * 60 * 60 },
];

export function rangeWindow(
  id: TimeRangeId,
  custom?: { from: string; to: string },
): { from: string; to: string } {
  if (id === 'custom' && custom?.from && custom?.to) {
    return { from: custom.from, to: custom.to };
  }
  const r = TIME_RANGES.find((t) => t.id === id);
  const seconds = r?.seconds ?? TIME_RANGES[1].seconds!;
  const to = new Date();
  const from = new Date(to.getTime() - seconds * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

/** Convert a `<input type="datetime-local">` value (local timezone, no Z) to an ISO string. */
export function localDateTimeToIso(local: string): string {
  if (!local) return '';
  const d = new Date(local);
  return isNaN(d.getTime()) ? '' : d.toISOString();
}

/** Inverse: convert an ISO string back to the format datetime-local expects. */
export function isoToLocalDateTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  // Build YYYY-MM-DDTHH:mm in local TZ
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}
