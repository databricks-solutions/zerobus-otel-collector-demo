import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { SqlBlock } from './SqlBlock';
import { GenieResultTable } from './GenieResultTable';
import type { GenieMessageState } from '@/lib/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string; // for user messages
  state?: GenieMessageState; // for assistant messages
  pending?: boolean;
  pendingLabel?: string;
}

interface Props {
  message: ChatMessage;
}

export function MessageBubble({ message }: Props) {
  if (message.role === 'user') {
    return <UserMessage content={message.content} />;
  }
  return <AssistantMessage message={message} />;
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex items-start gap-3 animate-fade-in">
      <div className="shrink-0 mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
        <User size={13} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">You</div>
        <div className="rounded-lg border border-surface-3/60 bg-surface-2/30 px-3.5 py-2.5 text-[14px] text-zinc-100 leading-relaxed whitespace-pre-wrap">
          {content}
        </div>
      </div>
    </div>
  );
}

function AssistantMessage({ message }: { message: ChatMessage }) {
  const state = message.state;
  return (
    <div className="flex items-start gap-3 animate-fade-in">
      <div className="shrink-0 mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
        <Bot size={13} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">
          Assistant
        </div>

        {message.pending && (
          <div className="flex items-center gap-2 text-[13px] text-zinc-400 px-3.5 py-2.5 rounded-lg border border-surface-3/60 bg-surface-2/20">
            <Spinner className="text-zinc-500" />
            <span>{message.pendingLabel || 'Thinking…'}</span>
          </div>
        )}

        {state?.error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-200">
            {state.error}
          </div>
        )}

        {state?.text_response && (
          <div className="prose prose-invert max-w-none text-[14px] leading-relaxed mb-3">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {state.text_response}
            </ReactMarkdown>
          </div>
        )}

        {state?.sql && (
          <div className={cn('mb-3', state.text_response ? '' : 'mt-1')}>
            <SqlBlock
              sql={state.sql}
              description={state.query_description}
              defaultOpen={!state.text_response}
            />
          </div>
        )}

        {state?.columns && state?.rows && (
          <GenieResultTable columns={state.columns} rows={state.rows} />
        )}

        {!message.pending &&
          !state?.text_response &&
          !state?.sql &&
          !state?.error && (
            <div className="text-[13px] text-zinc-500 italic">
              (Empty response)
            </div>
          )}
      </div>
    </div>
  );
}
