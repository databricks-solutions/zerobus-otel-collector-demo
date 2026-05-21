// Lightweight fetch helpers for the FastAPI backend.

export type Severity =
  | 'INFO'
  | 'WARN'
  | 'ERROR'
  | 'FATAL'
  | 'UNCLASSIFIED'
  | 'TRACE_CONTINUATION';

export interface Summary {
  total_logs: number;
  error_count: number;
  warn_count: number;
  error_rate: number;
  distinct_pods: number;
  distinct_services: number;
  distinct_namespaces: number;
  from: string;
  to: string;
}

export interface VolumePoint {
  bucket: string;
  INFO: number;
  WARN: number;
  ERROR: number;
  FATAL: number;
  UNCLASSIFIED: number;
  TRACE_CONTINUATION: number;
}

export interface VolumeResponse {
  bucket_seconds: number;
  from: string;
  to: string;
  series: VolumePoint[];
}

export interface ErrorRow {
  log_timestamp: string;
  parsed_severity: Severity;
  namespace: string;
  pod: string;
  deployment?: string | null;
  container?: string | null;
  service?: string | null;
  node?: string | null;
  body: string;
  body_length?: string | number | null;
  trace_id?: string | null;
  span_id?: string | null;
  container_restart_count?: string | number | null;
  log_iostream?: string | null;
}

export interface NoisyPodRow {
  namespace: string;
  pod: string;
  service: string | null;
  total: number;
  error_count: number;
  warn_count: number;
}

export interface GenieMessageState {
  status:
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'FAILED'
    | 'CANCELLED'
    | 'QUERY_RUNNING'
    | string;
  text_response?: string | null;
  sql?: string | null;
  query_description?: string | null;
  error?: string | null;
  columns?: { name: string; type_text: string }[];
  rows?: Record<string, any>[];
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${resp.status} ${resp.statusText}: ${text}`);
  }
  return (await resp.json()) as T;
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

export const api = {
  health: () => jsonFetch<{ status: string }>(`/api/health`),

  namespaces: () => jsonFetch<{ namespaces: string[] }>(`/api/dashboard/namespaces`),

  summary: (from: string, to: string, namespace?: string) =>
    jsonFetch<Summary>(`/api/dashboard/summary${qs({ from, to, namespace })}`),

  logVolume: (from: string, to: string, namespace?: string) =>
    jsonFetch<VolumeResponse>(`/api/dashboard/log-volume${qs({ from, to, namespace })}`),

  recentErrors: (limit: number, namespace?: string) =>
    jsonFetch<{ rows: ErrorRow[] }>(
      `/api/dashboard/recent-errors${qs({ limit, namespace })}`,
    ),

  noisyPods: (from: string, to: string, limit: number, namespace?: string) =>
    jsonFetch<{ rows: NoisyPodRow[] }>(
      `/api/dashboard/noisy-pods${qs({ from, to, limit, namespace })}`,
    ),

  genieAsk: (question: string, conversationId?: string) =>
    jsonFetch<{ conversation_id: string; message_id: string }>(
      `/api/genie/conversation`,
      {
        method: 'POST',
        body: JSON.stringify({ question, conversation_id: conversationId }),
      },
    ),

  genieMessage: (conversationId: string, messageId: string) =>
    jsonFetch<GenieMessageState>(`/api/genie/message/${conversationId}/${messageId}`),

  binPackingSummary: (from: string, to: string, namespace?: string) =>
    jsonFetch<BinPackingSummary>(
      `/api/binpacking/summary${qs({ from, to, namespace })}`,
    ),

  binPackingNodes: (from: string, to: string, namespace?: string) =>
    jsonFetch<{ rows: NodeUtilizationRow[] }>(
      `/api/binpacking/node-utilization${qs({ from, to, namespace })}`,
    ),

  binPackingOverProvisioned: (
    resource: 'cpu' | 'memory',
    from: string,
    to: string,
    limit: number,
    namespace?: string,
  ) =>
    jsonFetch<{ rows: OverProvisionedRow[]; resource: string }>(
      `/api/binpacking/over-provisioned${qs({ resource, from, to, limit, namespace })}`,
    ),

  binPackingConsolidation: (from: string, to: string, cpuPct = 40, memPct = 50) =>
    jsonFetch<{ rows: NodeUtilizationRow[]; cpu_threshold_pct: number; memory_threshold_pct: number }>(
      `/api/binpacking/consolidation${qs({ from, to, cpu_threshold_pct: cpuPct, memory_threshold_pct: memPct })}`,
    ),
};

export interface BinPackingSummary {
  pod_count: number;
  cpu_requested_cores: number;
  cpu_used_p95_cores: number;
  cpu_waste_cores: number;
  cpu_efficiency_pct: number | null;
  cpu_waste_pct: number | null;
  memory_requested_bytes: number;
  memory_used_p95_bytes: number;
  memory_waste_bytes: number;
  memory_efficiency_pct: number | null;
  memory_waste_pct: number | null;
  over_provisioned_cpu_count: number;
  over_provisioned_mem_count: number;
}

export interface NodeUtilizationRow {
  node: string;
  pod_count: string | number;
  cpu_capacity_cores: string | number | null;
  cpu_requested_cores: string | number | null;
  cpu_used_p95_cores: string | number | null;
  cpu_request_pct_of_capacity: string | number | null;
  cpu_usage_pct_of_capacity: string | number | null;
  memory_capacity_bytes_estimate: string | number | null;
  memory_requested_bytes: string | number | null;
  memory_used_p95_bytes: string | number | null;
  memory_request_pct_of_capacity: string | number | null;
  memory_usage_pct_of_capacity: string | number | null;
}

export interface OverProvisionedRow {
  namespace: string;
  pod: string;
  deployment: string | null;
  service: string | null;
  node: string | null;
  request: string | number | null;
  used_p95: string | number | null;
  waste: string | number | null;
  efficiency_pct: string | number | null;
}
