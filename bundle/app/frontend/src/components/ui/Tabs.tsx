import * as React from 'react';
import * as RTabs from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

export const Tabs = RTabs.Root;

export const TabsList = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof RTabs.List>
>(({ className, ...props }, ref) => (
  <RTabs.List
    ref={ref}
    className={cn(
      'inline-flex h-9 items-center gap-0.5 rounded-lg border border-surface-3/70 ' +
        'bg-surface-1/60 backdrop-blur p-1 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.4)]',
      className,
    )}
    {...props}
  />
));
TabsList.displayName = 'TabsList';

export const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof RTabs.Trigger>
>(({ className, ...props }, ref) => (
  <RTabs.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center gap-1.5 rounded-md px-3 h-7 text-[12.5px] font-medium ' +
        'text-zinc-400 hover:text-zinc-200 transition-all duration-150 ' +
        'data-[state=active]:bg-gradient-to-b data-[state=active]:from-surface-2 ' +
        'data-[state=active]:to-surface-2/70 data-[state=active]:text-zinc-100 ' +
        'data-[state=active]:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05),0_2px_8px_-2px_rgba(0,0,0,0.4)]',
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof RTabs.Content>
>(({ className, ...props }, ref) => (
  <RTabs.Content
    ref={ref}
    className={cn('outline-none', className)}
    {...props}
  />
));
TabsContent.displayName = 'TabsContent';
