# OTel Observability — Databricks App

A polished Databricks App for the Zerobus → OTel pipeline. Two surfaces:

- **Dashboard** — log volume by severity, top noisy pods, recent errors, summary KPIs. All filtered by time range and namespace.
- **Ask Genie** — embedded conversational chat over the OTel silver tables (`logs_flattened`, `logs_errors`, `logs_coredns_parsed`). Renders Genie's natural-language summary, the generated SQL, and the result table.

Backend is FastAPI. Frontend is React + Vite + TypeScript + Tailwind + Recharts. All data is read live from Unity Catalog through the SQL Warehouse Statement Execution API. The Genie tab proxies the Genie Conversation API.

---

## 1. One-time Databricks setup

### 1a. Create a Genie Space

1. In the workspace, go to **Genie** → **New Genie Space**.
2. Name it: **OTel Observability**.
3. Add the following tables from `otel.kubernetes_otel_silver`:
   - `logs_flattened`
   - `logs_errors`
   - `logs_coredns_parsed`
4. Add column-level descriptions for the most useful fields. At minimum:
   - `parsed_severity` — "Severity bucket: INFO, WARN, ERROR, FATAL, UNCLASSIFIED, TRACE_CONTINUATION."
   - `log_timestamp` — "Time the log line was emitted by the workload."
   - `namespace`, `pod`, `deployment`, `daemonset`, `container`, `service`, `node` — Kubernetes attribution.
   - `body` — "Raw log message text."
   - `is_stack_trace_line` — "True if this row is a continuation of a stack trace."
5. Add sample / example questions:
   - "Show me errors in the last hour"
   - "Which pods have the most errors?"
   - "What namespaces are noisiest?"
   - "Find log lines mentioning timeout"
6. Save. Grab the **Space ID** from the URL (`/genie/rooms/<SPACE_ID>` or `/genie/spaces/<SPACE_ID>`).

### 1b. Pick a SQL warehouse

Pick a **serverless** SQL warehouse you want the app to query through. Note its ID (the `id=` query param on the warehouse details page, or `databricks warehouses list`).

---

## 2. Local dev

You have `DATABRICKS_HOST` + `DATABRICKS_TOKEN` set already from the Terraform setup, so the SDK's default profile will work.

```bash
cd app

# Install Python deps with uv (creates .venv).
uv sync

# Configure env (one-time).
cp .env.example .env
# Edit .env — set DATABRICKS_WAREHOUSE_ID and GENIE_SPACE_ID.
# DATABRICKS_PROFILE=DEFAULT is fine if your DEFAULT profile points at the
# right workspace, otherwise set it to whichever profile name you use.

# Start the FastAPI backend (port 8000).
uv run uvicorn app:app --reload --port 8000

# In another terminal — start the Vite dev server (port 5173, proxied to 8000).
cd app/frontend
npm install
npm run dev
```

Hit **http://localhost:5173**.

Sanity check the API directly: `curl http://localhost:8000/api/health`.

---

## 3. Deploy

Build the frontend and ship the whole `app/` directory.

```bash
# From repo root
cd app/frontend
npm run build
cd ..

# Create the app (first time only)
databricks apps create otel-observability \
  --description "OpenTelemetry observability dashboard + Genie chat"

# Sync the project to the workspace, excluding source-only directories.
databricks sync . /Workspace/Users/<your-email>@databricks.com/otel-observability \
  --exclude node_modules \
  --exclude .venv \
  --exclude __pycache__ \
  --exclude .git \
  --exclude "frontend/src" \
  --exclude "frontend/public"

# Deploy
databricks apps deploy otel-observability \
  --source-code-path /Workspace/Users/<your-email>@databricks.com/otel-observability
```

### Post-deploy: wire up resources + env vars in the App UI

Open **Compute → Apps → otel-observability → Edit**:

1. **Add resource → SQL Warehouse** — pick your warehouse, permission **Can use**, key: `sql-warehouse` (any key is fine; we read by env var).
2. **Add resource → Genie Space** — pick the OTel Genie space, permission **Can run**, key: `genie-space`.
3. **Environment variables** (under "Advanced settings"):
   - `DATABRICKS_WAREHOUSE_ID` = your warehouse ID
   - `GENIE_SPACE_ID` = your Genie space ID
   - `OTEL_CATALOG` = `otel` (default)
   - `OTEL_SCHEMA` = `kubernetes_otel_silver` (default)
4. Save and redeploy if prompted.

### Grant the App's service principal Unity Catalog access

The App runs as its own SP. Grant it (replace the SP name from the App UI):

```sql
GRANT USE CATALOG ON CATALOG `otel` TO `<app-service-principal>`;
GRANT USE SCHEMA ON SCHEMA `otel`.`kubernetes_otel_silver` TO `<app-service-principal>`;
GRANT SELECT ON TABLE `otel`.`kubernetes_otel_silver`.`logs_flattened` TO `<app-service-principal>`;
GRANT SELECT ON TABLE `otel`.`kubernetes_otel_silver`.`logs_errors` TO `<app-service-principal>`;
GRANT SELECT ON TABLE `otel`.`kubernetes_otel_silver`.`logs_coredns_parsed` TO `<app-service-principal>`;
```

The Genie Space and SQL Warehouse permissions are wired through the App's **resources** (step 1–2 above), so you don't need to manage them separately.

---

## Project layout

```
app/
├── app.py                       # FastAPI entry, mounts API + serves built SPA
├── app.yaml                     # Databricks App config
├── pyproject.toml               # Python deps (uv)
├── requirements.txt             # Pinned deps for deployment
├── .env.example                 # Local env template
├── server/
│   ├── config.py                # Dual-mode auth (CLI profile / SP)
│   ├── sql.py                   # SQL Warehouse Statement Execution helper
│   ├── genie.py                 # Genie Conversation API client
│   └── routes/
│       ├── dashboard.py         # /api/dashboard/*
│       └── genie.py             # /api/genie/*
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx              # Top-level shell + tabs
        ├── styles.css
        ├── lib/
        │   ├── api.ts           # Typed fetch client
        │   ├── timeRanges.ts
        │   └── utils.ts
        └── components/
            ├── ui/              # Button, Card, Badge, Select, Tabs, Input, Spinner
            ├── dashboard/       # Filter bar, stat cards, charts, panels
            └── genie/           # Chat shell, message bubble, SQL block, result table
```

## Endpoint reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | App / config sanity check |
| GET | `/api/dashboard/namespaces` | Distinct namespaces for the filter |
| GET | `/api/dashboard/summary?from&to&namespace` | KPI tiles (total, errors, error rate, pods) |
| GET | `/api/dashboard/log-volume?from&to&namespace` | Time-bucketed counts by severity (auto bucket) |
| GET | `/api/dashboard/recent-errors?limit&namespace` | Recent rows from `logs_errors` |
| GET | `/api/dashboard/noisy-pods?from&to&limit&namespace` | Top pods by log volume + error count |
| POST | `/api/genie/conversation` | Start or continue a Genie conversation |
| GET | `/api/genie/message/{conv_id}/{msg_id}` | Poll a message; returns text, SQL, columns, rows |

## Notes

- Time bucketing for `/log-volume` is auto-derived: minute buckets under 2h, hour buckets under 2d, day buckets above. Rendered as a stacked area chart.
- The Genie tab polls `GET /api/genie/message/...` every 1.5s until the message reaches a terminal status (`COMPLETED`, `FAILED`, `CANCELLED`). When the query attachment is still running, the backend surfaces `QUERY_RUNNING` so the UI can show "Running query on warehouse…".
- All SQL goes through parameterized statements (no string interpolation of user input) to prevent injection through namespace filters etc.
