import { useEffect, useState } from 'react';
import { Activity, Moon, Package, Sun, Telescope } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { GenieFab } from '@/components/genie/GenieFab';
import { BinPacking } from '@/components/binpacking/BinPacking';

function useDarkMode() {
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = window.localStorage.getItem('otel-theme');
    if (stored) return stored === 'dark';
    return true;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
    window.localStorage.setItem('otel-theme', dark ? 'dark' : 'light');
  }, [dark]);

  return [dark, setDark] as const;
}

export default function App() {
  const [dark, setDark] = useDarkMode();

  return (
    <div className="min-h-screen flex flex-col app-bg">
      <Header dark={dark} onToggleTheme={() => setDark(!dark)} />
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 pt-5 pb-10">
        <Tabs defaultValue="dashboard">
          <div className="flex items-center justify-between mb-5">
            <TabsList>
              <TabsTrigger value="dashboard">
                <Activity size={13} />
                <span>Dashboard</span>
              </TabsTrigger>
              <TabsTrigger value="binpacking">
                <Package size={13} />
                <span>Bin Packing</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="dashboard" className="animate-fade-in">
            <Dashboard />
          </TabsContent>
          <TabsContent value="binpacking" className="animate-fade-in">
            <BinPacking />
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
      <GenieFab />
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-auto border-t border-surface-3/40 py-4 text-[11px] text-zinc-500">
      <div className="max-w-[1400px] mx-auto px-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          OpenTelemetry-based observability for Kubernetes
        </div>
        <div>Built on Databricks</div>
      </div>
    </footer>
  );
}

function Header({ dark, onToggleTheme }: { dark: boolean; onToggleTheme: () => void }) {
  return (
    <header className="border-b border-surface-3/60 bg-surface-0/85 backdrop-blur-md sticky top-0 z-20">
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500/40 via-blue-500/15 to-violet-500/20 border border-blue-500/30 flex items-center justify-center shadow-[0_4px_14px_-4px_rgba(59,130,246,0.4)]">
            <Telescope size={15} className="text-blue-200" />
          </div>
          <div className="text-[14px] font-semibold tracking-tight text-zinc-100">
            OTel Observability
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-live-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[10.5px] font-medium text-emerald-300 tracking-wide">live</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
          >
            {dark ? <Sun size={14} /> : <Moon size={14} />}
          </Button>
        </div>
      </div>
    </header>
  );
}
