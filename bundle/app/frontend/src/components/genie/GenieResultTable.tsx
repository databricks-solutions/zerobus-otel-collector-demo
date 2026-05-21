import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface Props {
  columns: { name: string; type_text: string }[];
  rows: Record<string, any>[];
}

const PAGE_SIZE = 20;

export function GenieResultTable({ columns, rows }: Props) {
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const sorted = [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const an = Number(av);
      const bn = Number(bv);
      if (!isNaN(an) && !isNaN(bn)) return an - bn;
      return String(av).localeCompare(String(bv));
    });
    return sortDir === 'desc' ? sorted.reverse() : sorted;
  }, [rows, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const view = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(col: string) {
    if (sortKey === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(col);
      setSortDir('asc');
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-surface-3/70 bg-surface-2/40 px-3 py-2 text-[12px] text-zinc-500">
        No rows returned.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-surface-3/70 overflow-hidden">
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-surface-2/95 backdrop-blur z-10">
            <tr className="text-[11px] uppercase tracking-wider text-zinc-500">
              {columns.map((c) => (
                <th
                  key={c.name}
                  className="px-3 py-2 font-medium cursor-pointer hover:text-zinc-200 select-none whitespace-nowrap"
                  onClick={() => toggleSort(c.name)}
                >
                  <span>{c.name}</span>
                  {sortKey === c.name && (
                    <span className="ml-1 text-blue-400">
                      {sortDir === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                  <span className="ml-1 text-zinc-600 normal-case">{c.type_text}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((r, i) => (
              <tr
                key={i}
                className={cn(
                  'border-t border-surface-3/40 hover:bg-surface-2/40',
                  i % 2 === 0 ? 'bg-transparent' : 'bg-surface-2/20',
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.name}
                    className="px-3 py-1.5 mono text-[12.5px] text-zinc-200 whitespace-nowrap"
                  >
                    {formatCell(r[c.name])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-surface-3/60 text-[12px] text-zinc-400">
          <div>
            Showing {page * PAGE_SIZE + 1}–{Math.min(sorted.length, (page + 1) * PAGE_SIZE)} of{' '}
            {sorted.length}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft size={14} />
            </Button>
            <span className="mono">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatCell(v: any): string {
  if (v == null) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
