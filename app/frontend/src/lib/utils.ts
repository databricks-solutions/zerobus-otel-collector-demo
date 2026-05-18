import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number | string | null | undefined): string {
  const num = typeof n === 'string' ? Number(n) : n ?? 0;
  if (!isFinite(num as number)) return '0';
  return new Intl.NumberFormat().format(num as number);
}

export function formatPercent(n: number, digits = 2): string {
  if (!isFinite(n)) return '0%';
  return `${(n * 100).toFixed(digits)}%`;
}

export function formatTimestamp(ts: string | number | null | undefined): string {
  if (ts == null || ts === '') return '';
  const d = typeof ts === 'string' ? new Date(ts) : new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  return d.toISOString().replace('T', ' ').slice(0, 23);
}

export function shortTimestamp(ts: string | number | null | undefined): string {
  if (ts == null) return '';
  const d = typeof ts === 'string' ? new Date(ts) : new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatBytes(bytes: number | string | null | undefined, digits = 1): string {
  const n = typeof bytes === 'string' ? Number(bytes) : bytes ?? 0;
  if (!isFinite(n) || n === 0) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(Math.abs(n)) / Math.log(k)));
  return `${(n / Math.pow(k, i)).toFixed(digits)} ${units[i]}`;
}

export function formatCores(cores: number | string | null | undefined, digits = 2): string {
  const n = typeof cores === 'string' ? Number(cores) : cores ?? 0;
  if (!isFinite(n)) return '0';
  if (n < 0.01 && n > 0) return `${(n * 1000).toFixed(0)}m`;
  if (n < 1) return `${(n * 1000).toFixed(0)}m`;
  return `${n.toFixed(digits)}`;
}
