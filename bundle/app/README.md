# OTel Observability — Databricks App

A Databricks App for the Zerobus → OTel pipeline. Two main surfaces plus an embedded assistant:

- **Dashboard** — log volume by severity, top noisy pods, recent errors, summary KPIs. Filtered by time range and namespace.
- **Bin Packing** — cluster cost/efficiency analytics over the silver metrics tables: node utilization, over-provisioned pods, consolidation candidates, per-pod request-vs-usage efficiency.
- **Ask Genie** (floating action button) — embedded chat over the OTel silver tables. Renders Genie's natural-language summary, the generated SQL, and the result table.

Backend is FastAPI. Frontend is React + Vite + TypeScript + Tailwind + Recharts. All data is read live from Unity Catalog through the SQL Warehouse Statement Execution API. Genie calls proxy through the Genie Conversation API.

---

## Prerequisites

One-time Databricks platform setup (catalog/schema bootstrap, **Genie Space creation**, SQL warehouse selection) is documented in the **root-level README**. Once you have:

- A SQL warehouse ID
- A Genie Space ID configured against the OTel silver tables
- Permission to deploy bundles (or to create apps) in your workspace

…you can proceed.

---

## 1. Local dev

Local dev uses your `DATABRICKS_HOST` + `DATABRICKS_TOKEN` (or a CLI profile) for SDK auth.

```bash
cd bundle/app

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
cd bundle/app/frontend
npm install
npm run dev
```

Hit **http://localhost:5173**.

Sanity-check the API directly: `curl http://localhost:8000/api/health`.

---

## 2. Deploy

Two paths. The bundle flow is recommended; the manual flow is documented for cases where you want to iterate on the app without re-running the whole bundle.

### Option A: Bundle (recommended)

From the repo root:

```bash
./bundle/deploy.sh              # defaults to "dev" target
./bundle/deploy.sh prod         # for prod
```

The script:

1. Builds the React frontend (`frontend_build` bundle script).
2. `databricks bundle deploy --target $TARGET`.
3. Triggers the three silver pipelines (logs, spans, metrics).

The app resource, its SQL warehouse and Genie space wiring, env vars, and start command are all defined declaratively in `bundle/resources/app.yml` and substituted from bundle variables.

### Option B: Manual

Useful when iterating on the app alone.

```bash
# From bundle/app
cd frontend && npm install && npm run build && cd ..

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

Then in **Compute → Apps → otel-observability → Edit**:

1. **User authorization** — add the `sql` and `dashboards.genie` scopes (requires a
   workspace admin to have enabled the user authorization preview first; see the next
   section). The app needs no SQL Warehouse or Genie Space **resources** — all data
   access happens as the signed-in user, not the app's service principal.
2. **Environment variables**:
   - `DATABRICKS_WAREHOUSE_ID` = your warehouse ID
   - `GENIE_SPACE_ID` = your Genie space ID
   - `OTEL_CATALOG` = `otel` (or override)
   - `OTEL_SCHEMA` = `kubernetes_otel_silver` (or override)
3. Save and redeploy if prompted.

### On-behalf-of-user (OBO) authorization

The app reads data **as the signed-in user**, not as its own service principal. Every
UC-governed call (SQL Statement Execution, Genie Conversation API) uses the token
Databricks Apps forwards for the current user via the `x-forwarded-access-token`
header, so query results are governed by that user's own Unity Catalog grants.

This requires two things:

1. **User authorization scopes are declared in the bundle.** `bundle/resources/app.yml`
   sets `user_api_scopes: [sql, dashboards.genie]` on the app resource — this is what
   allows the app to request the user's forwarded token for those two APIs at all.
2. **A workspace admin must enable the user authorization preview once, for the
   workspace** (it's a Public Preview feature and isn't toggled by the bundle deploy
   itself). After enabling it, **stop and start the app** so the scopes take effect —
   you can confirm they're present under Compute → Apps → `<app>` → Edit →
   **User authorization**. Each user consents to the scopes the first time they open
   the app. Until all of this is done, requests fail with a "missing
   x-forwarded-access-token" error (see `server/config.py::get_user_token`).

### Who needs what permissions

Because every data-plane call runs as the viewing user, the app's own service principal
needs **no grants at all** — the bundle grants it nothing, and the app declares no
warehouse or Genie resources. Instead, each user (or group) who will view the app needs
all three of the following:

1. **UC grants on the OTel data:**

   ```sql
   GRANT USE CATALOG ON CATALOG `otel` TO `<user_or_group>`;
   GRANT USE SCHEMA  ON SCHEMA  `otel`.`kubernetes_otel_silver` TO `<user_or_group>`;
   GRANT SELECT      ON SCHEMA  `otel`.`kubernetes_otel_silver` TO `<user_or_group>`;
   ```

2. **`CAN USE` on the SQL warehouse** the app queries (the one the bundle creates).
   Grant it in the UI (Compute → SQL warehouses → `<warehouse>` → Permissions), or
   declare it on the warehouse resource in `bundle/resources/warehouse.yml`:

   ```yaml
   permissions:
     - level: CAN_USE
       group_name: <viewers-group>
   ```

3. **`CAN RUN` on the Genie space** (share it from the Genie space UI). The Genie
   Conversation API also requires the caller to have access to a pro or serverless SQL
   warehouse, which the warehouse grant above covers.

A user missing any of these will see permission errors from the corresponding
dashboard or Genie calls — that's OBO working as intended: the app can never show
someone data they couldn't query themselves.

Locally (outside Databricks Apps), there's no forwarded-token header, so the app falls
back to your own CLI-profile/token-based credentials — effectively already "as you".

---

## Project layout

```
bundle/app/
├── app.py                       # FastAPI entry; mounts API + serves built SPA
├── app.yaml                     # Databricks App config (gitignored; rendered by deploy)
├── app.yaml.example             # Template showing the app.yaml shape
├── pyproject.toml               # Python deps (uv)
├── uv.lock                      # uv lockfile
├── requirements.txt             # Pinned deps for the deployed app runtime
├── .env.example                 # Local env template
├── server/
│   ├── config.py                # OBO user token resolution (CLI profile fallback locally)
│   ├── sql.py                   # SQL Warehouse Statement Execution helper
│   ├── genie.py                 # Genie Conversation API client
│   └── routes/
│       ├── dashboard.py         # /api/dashboard/*
│       ├── binpacking.py        # /api/binpacking/*
│       └── genie.py             # /api/genie/*
└── frontend/
    ├── package.json
    ├── tsconfig.json            # TS project-references root
    ├── tsconfig.app.json        # src/** type-check config
    ├── tsconfig.node.json       # vite.config.ts type-check config
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── .npmrc
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
            ├── ui/              # Button, Card, Badge, Select, Tabs, Input, Spinner, InfoHint, PageHero, TimeRangeControl
            ├── dashboard/       # Filter bar, stat cards, log-volume chart, noisy pods, recent errors
            ├── binpacking/      # BinPacking shell + node-utilization, over-provisioned, consolidation, stat cards panels
            └── genie/           # GenieFab (floating button), message bubble, SQL block, result table
```

---

## Endpoint reference

| Method | Path | Description |
|---|---|---|
| GET  | `/api/health` | App / config sanity check |
| GET  | `/api/dashboard/namespaces` | Distinct namespaces for the filter |
| GET  | `/api/dashboard/summary?from&to&namespace` | KPI tiles (total, errors, error rate, pods) |
| GET  | `/api/dashboard/log-volume?from&to&namespace` | Time-bucketed counts by severity (auto bucket) |
| GET  | `/api/dashboard/recent-errors?limit&namespace` | Recent rows from `logs_errors` |
| GET  | `/api/dashboard/noisy-pods?from&to&limit&namespace` | Top pods by log volume + error count |
| GET  | `/api/binpacking/summary` | Cluster-wide bin-packing KPI tiles |
| GET  | `/api/binpacking/node-utilization` | Per-node requested-vs-used CPU + memory |
| GET  | `/api/binpacking/over-provisioned` | Pods with low efficiency (request ≫ p95 usage) |
| GET  | `/api/binpacking/consolidation` | Nodes that could potentially be drained |
| GET  | `/api/binpacking/pod-efficiency` | Per-pod request/usage breakdown |
| POST | `/api/genie/conversation` | Start or continue a Genie conversation |
| GET  | `/api/genie/message/{conv_id}/{msg_id}` | Poll a message; returns text, SQL, columns, rows |

---

## Notes

- Time bucketing for `/log-volume` is auto-derived: minute buckets under 2h, hour buckets under 2d, day buckets above. Rendered as a stacked area chart.
- The Genie panel polls `GET /api/genie/message/...` every 1.5s until the message reaches a terminal status (`COMPLETED`, `FAILED`, `CANCELLED`). When the query attachment is still running, the backend surfaces `QUERY_RUNNING` so the UI can show "Running query on warehouse…".
- All SQL goes through parameterized statements (no string interpolation of user input) to prevent injection through namespace filters etc.
- The frontend build (`tsc -b && vite build`) needs the three tsconfig files under `frontend/`. They are checked in; if `npm run build` errors with `TS5083: Cannot read file '.../tsconfig.json'`, your clone is missing them.
