import * as React from 'react';
import * as RSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectProps {
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  triggerClassName,
}: SelectProps) {
  return (
    <RSelect.Root value={value} onValueChange={onValueChange}>
      <RSelect.Trigger
        className={cn(
          'inline-flex h-9 items-center justify-between gap-2 rounded-md ' +
            'border border-surface-3 bg-surface-2/60 px-3 text-[13px] text-zinc-200 ' +
            'hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40 ' +
            'min-w-[140px]',
          triggerClassName,
          className,
        )}
      >
        <RSelect.Value placeholder={placeholder} />
        <RSelect.Icon>
          <ChevronDown size={14} className="text-zinc-500" />
        </RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={6}
          className={cn(
            'z-50 max-h-[320px] overflow-hidden rounded-md border border-surface-3 ' +
              'bg-surface-1 shadow-lg animate-fade-in',
          )}
        >
          <RSelect.Viewport className="p-1">
            {options.map((opt) => (
              <RSelect.Item
                key={opt.value}
                value={opt.value}
                className={cn(
                  'relative flex cursor-pointer select-none items-center justify-between ' +
                    'rounded-sm px-2.5 py-1.5 text-[13px] text-zinc-200 outline-none ' +
                    'data-[highlighted]:bg-surface-2 data-[state=checked]:text-blue-300',
                )}
              >
                <RSelect.ItemText>{opt.label}</RSelect.ItemText>
                <RSelect.ItemIndicator>
                  <Check size={14} className="text-blue-400" />
                </RSelect.ItemIndicator>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}
