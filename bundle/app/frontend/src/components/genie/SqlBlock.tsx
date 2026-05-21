import { useState } from 'react';
import { ChevronDown, Copy, Check } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface Props {
  sql: string;
  description?: string | null;
  defaultOpen?: boolean;
}

export function SqlBlock({ sql, description, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(sql).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="rounded-lg border border-surface-3/70 bg-surface-2/40 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-surface-2/70 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ChevronDown
            size={14}
            className={cn(
              'text-zinc-500 transition-transform',
              !open && '-rotate-90',
            )}
          />
          <span className="text-[12px] font-medium text-zinc-300 uppercase tracking-wider">
            Generated SQL
          </span>
          {description && (
            <span className="text-[12px] text-zinc-500 truncate max-w-[420px]">
              · {description}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            copy();
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </Button>
      </button>
      {open && (
        <div className="border-t border-surface-3/60 max-h-[280px] overflow-auto">
          <SyntaxHighlighter
            language="sql"
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              padding: '12px 14px',
              background: 'transparent',
              fontSize: 12.5,
              fontFamily:
                "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
            wrapLongLines
          >
            {sql}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  );
}
