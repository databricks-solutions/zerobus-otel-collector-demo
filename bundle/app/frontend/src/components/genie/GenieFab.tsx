import { useEffect, useRef, useState } from 'react';
import { Plus, Send, Sparkles, X } from 'lucide-react';
import { api, type GenieMessageState } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { MessageBubble, type ChatMessage } from './MessageBubble';
import { cn } from '@/lib/utils';

const SUGGESTED_QUESTIONS = [
  'Show me errors in the last hour',
  'Which pods have the most errors?',
  'What namespaces are noisiest?',
  'Find log lines mentioning timeout',
];

const POLL_INTERVAL_MS = 1500;

export function GenieFab() {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pollRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, []);

  // Esc to close, focus input on open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function newConversation() {
    if (pollRef.current) window.clearTimeout(pollRef.current);
    setConversationId(null);
    setMessages([]);
    setBusy(false);
  }

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setInput('');

    const placeholderId = `assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', content: question },
      {
        id: placeholderId,
        role: 'assistant',
        content: '',
        pending: true,
        pendingLabel: 'Thinking…',
      },
    ]);
    setBusy(true);

    try {
      const start = await api.genieAsk(question, conversationId ?? undefined);
      if (!conversationId) setConversationId(start.conversation_id);
      pollMessage(start.conversation_id, start.message_id, placeholderId);
    } catch (e: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? {
                ...m,
                pending: false,
                state: { status: 'FAILED', error: String(e?.message || e) },
              }
            : m,
        ),
      );
      setBusy(false);
    }
  }

  function pollMessage(convId: string, msgId: string, placeholderId: string) {
    let cancelled = false;

    async function tick() {
      if (cancelled) return;
      try {
        const state: GenieMessageState = await api.genieMessage(convId, msgId);
        const status = state.status;
        const terminal =
          status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED';
        const queryRunning = status === 'QUERY_RUNNING';
        const pendingLabel =
          status === 'IN_PROGRESS'
            ? 'Generating query…'
            : queryRunning
              ? 'Running query…'
              : 'Working…';

        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderId
              ? { ...m, pending: !terminal, pendingLabel, state }
              : m,
          ),
        );

        if (!terminal) {
          pollRef.current = window.setTimeout(tick, POLL_INTERVAL_MS);
        } else {
          setBusy(false);
        }
      } catch (e: any) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderId
              ? {
                  ...m,
                  pending: false,
                  state: { status: 'FAILED', error: String(e?.message || e) },
                }
              : m,
          ),
        );
        setBusy(false);
      }
    }

    tick();
    return () => {
      cancelled = true;
    };
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ask(input);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={cn(
          'fixed inset-0 z-40 transition-opacity duration-200',
          'bg-black/40 backdrop-blur-[2px]',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      />

      {/* Slide-in panel */}
      <aside
        role="dialog"
        aria-label="Assistant"
        aria-hidden={!open}
        className={cn(
          'fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[460px] md:w-[520px]',
          'bg-surface-0/95 backdrop-blur-xl border-l border-surface-3/60 shadow-2xl',
          'flex flex-col transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 h-14 border-b border-surface-3/60 bg-gradient-to-r from-violet-500/[0.04] to-transparent">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-7 w-7 rounded-md bg-gradient-to-br from-violet-500/30 to-blue-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
              <Sparkles size={14} className="text-violet-300" />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-zinc-100 leading-tight">
                Assistant
              </div>
              <div className="text-[11px] text-zinc-500 leading-tight">
                Ask anything about your telemetry
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={newConversation}
                disabled={busy}
                className="text-[11.5px]"
              >
                <Plus size={11} />
                <span>New</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
            >
              <X size={14} />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div ref={scrollRef} className="flex-1 overflow-auto p-5 space-y-5">
          {messages.length === 0 ? (
            <EmptyState onPick={ask} />
          ) : (
            messages.map((m) => <MessageBubble key={m.id} message={m} />)
          )}
        </div>

        {/* Suggested chips when conversation in progress */}
        {messages.length > 0 && (
          <div className="px-5 pt-2 border-t border-surface-3/60">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  disabled={busy}
                  className="text-[11.5px] rounded-full border border-surface-3/70 bg-surface-2/40 px-2.5 py-0.5 text-zinc-400 hover:bg-surface-2 hover:text-zinc-100 disabled:opacity-50 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div
          className={cn(
            'p-4 border-t border-surface-3/60 bg-surface-1/40',
            messages.length > 0 && 'pt-2',
          )}
        >
          <div className="flex items-end gap-2">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask about logs, pods, errors, namespaces…"
              rows={2}
              disabled={busy}
              className="min-h-[44px] flex-1"
            />
            <Button
              variant="primary"
              size="md"
              disabled={busy || !input.trim()}
              onClick={() => ask(input)}
              className="h-[44px] px-3.5"
            >
              {busy ? <Spinner /> : <Send size={14} />}
            </Button>
          </div>
          <div className="text-[10.5px] text-zinc-600 mt-1.5">
            Enter to send · Shift+Enter for newline · Esc to close
          </div>
        </div>
      </aside>

      {/* Floating action button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open assistant"
        className={cn(
          'fixed bottom-6 right-6 z-30 h-12 w-12 rounded-full',
          'bg-gradient-to-br from-violet-500 to-blue-500',
          'shadow-[0_8px_28px_-6px_rgba(139,92,246,0.55)]',
          'flex items-center justify-center text-white',
          'hover:scale-105 hover:shadow-[0_12px_32px_-4px_rgba(139,92,246,0.7)]',
          'active:scale-95 transition-all duration-200',
          'ring-1 ring-white/10',
          open && 'opacity-0 pointer-events-none scale-90',
        )}
      >
        <span className="absolute inset-0 rounded-full animate-genie-pulse opacity-60" />
        <Sparkles size={18} className="relative z-10 drop-shadow-sm" />
      </button>
    </>
  );
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto py-6">
      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-blue-500/15 border border-violet-500/30 flex items-center justify-center mb-4 shadow-[0_8px_24px_-8px_rgba(139,92,246,0.4)]">
        <Sparkles size={18} className="text-violet-300" />
      </div>
      <h2 className="text-[15px] font-semibold text-zinc-100 mb-1.5 tracking-tight">
        Ask anything about your telemetry
      </h2>
      <p className="text-[12.5px] text-zinc-400 leading-relaxed mb-5">
        Type a question in plain English — the assistant figures out the query
        and shows you the answer. Try one of these to start:
      </p>
      <div className="grid grid-cols-1 gap-1.5 w-full">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            className="text-left text-[12.5px] rounded-lg border border-surface-3/60 bg-surface-2/30 px-3 py-2 text-zinc-200 hover:bg-surface-2/60 hover:border-violet-500/40 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
