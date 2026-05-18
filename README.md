# Zerobus + OpenTelemetry on Databricks

End-to-end demo of using **Databricks** as the observability backend for a Kubernetes cluster — replacing the usual Datadog/Splunk/Grafana stack:

```
k8s pods ──► OTel Collector ──► Zerobus ──► Delta bronze ──► silver pipelines ──► Databricks App + Assistant
```

The repo deploys:
- A Databricks service principal + Unity Catalog bronze tables for OTel logs/metrics/traces.
- An OpenTelemetry Collector + demo app on a local minikube cluster, shipping telemetry to Zerobus.
- Spark Declarative Pipelines that refine bronze into queryable silver tables.
- A full-stack Databricks App with dashboards, bin-packing analysis, and an embedded natural-language assistant.

## Prerequisites

- A Databricks workspace with **Zerobus enabled** and Unity Catalog
- A Databricks PAT (workspace admin) — `DATABRICKS_HOST` and `DATABRICKS_TOKEN` exported
- Local tools: `terraform`, `minikube`, `kubectl`, `helm`, `databricks` CLI (≥ 0.279), `node`/`npm`, `uv`
- A serverless SQL warehouse and a Genie Space (created once in the UI; instructions below)

## Deployment in two commands

### 1. Provision the ingest path

Brings up minikube + the OTel Collector + bronze tables + service principal:

```sh
cd tf
cp local.auto.tfvars.example local.auto.tfvars
# Fill in zerobus_catalog and warehouse_name in the file, then:
terraform init && terraform apply
```

After this, telemetry flows from minikube into the bronze tables. Verify:

```sql
SELECT count(*) FROM otel.otel_bronze.kubernetes_otel_logs;
```

### 2. Deploy the silver pipelines and the app

One-time UI setup (create the Genie Space the assistant queries):
1. **Genie → New Space** → name "OTel Observability"
2. Add tables: `logs_flattened`, `logs_errors`, `logs_coredns_parsed` (and bin-packing tables once they exist)
3. Copy the Space ID from the URL

Then a single script builds the frontend, deploys silver pipelines + the app, and applies all the grants:

```sh
cd ..  # back to repo root
./scripts/deploy.sh --target dev \
  --var "warehouse_id=<your-warehouse-id>" \
  --var "genie_space_id=<your-genie-space-id>" \
  --var "app_otel_schema=dev_<your_short_name>_kubernetes_otel_silver"
```

For prod (no schema prefix):

```sh
./scripts/deploy.sh --target prod \
  --var "warehouse_id=<your-warehouse-id>" \
  --var "genie_space_id=<your-genie-space-id>"
# app_otel_schema defaults to `kubernetes_otel_silver` in prod
```

The script:
- Builds the React frontend (`npm install && npm run build`)
- Renders `app/app.yaml` (env vars) from the bundle variables you passed
- Runs `databricks bundle deploy` — creates silver schema, pipelines, and app
- Auto-grants the app's service principal `SELECT` on every silver table, plus `CAN_USE` on the warehouse and `CAN_RUN` on the Genie Space (declared in `resources/app.yml`)
- Grants `USE_CATALOG` and `USE_SCHEMA` to the app's SP via `scripts/grant-app-permissions.sh`
- Prints the app URL

> **Tip:** to avoid passing `--var` flags every time, create `bundle.local.yml` (gitignored) with target-specific defaults. Or just save the full command in a shell alias.

Run the silver pipelines once they're deployed:

```sh
databricks bundle run logs_silver --target dev
databricks bundle run metrics_silver --target dev
databricks bundle run spans_silver --target dev
```

Get the app URL:

```sh
databricks apps get otel-observability
```

### Production

For a non-dev rollout (no schema prefix, paused schedules off, shared workspace path):

```sh
databricks bundle deploy --target prod \
  --var "warehouse_id=<warehouse id>" \
  --var "genie_space_id=<genie space id>"
# `app_otel_schema` defaults to `kubernetes_otel_silver` in prod — no override needed
```

## Repo layout

```
databricks.yml         # bundle root — defines variables, includes resources, pre-deploy hook
resources/             # bundle resource definitions
  ├── job.yml          # init job that creates bronze table schemas
  ├── schema.yml       # silver schema
  ├── *_pipeline.yml   # logs / metrics / spans silver pipelines
  └── app.yml          # the Databricks App + its declarative resource grants
src/                   # silver pipeline notebooks (DLT)
app/                   # FastAPI backend + React/Vite/TS frontend
tf/                    # Terraform: SP, bronze tables, OTel Collector helm release
pyproject.toml         # bundle Python deps
```

## Local development

The app can run outside Databricks for fast iteration:

```sh
cd app
cp .env.example .env   # fill in DATABRICKS_WAREHOUSE_ID + GENIE_SPACE_ID + OTEL_SCHEMA
uv sync
uv run uvicorn app:app --reload --port 8000
# in another terminal:
cd frontend && npm install && npm run dev
# open http://localhost:5173
```

## Tear-down

```sh
databricks bundle destroy --target dev   # removes app, pipelines, schema
cd tf && terraform destroy               # removes SP, bronze tables, helm releases
minikube stop                            # or `minikube delete`
```

## How to get help

Databricks support doesn't cover this content. For questions or bugs, please open a GitHub issue and the team will help on a best-effort basis.

## License

&copy; 2025 Databricks, Inc. All rights reserved. The source in this notebook is provided subject to the Databricks License [https://databricks.com/db-license-source]. All included or referenced third party libraries are subject to the licenses set forth below.

| library | description | license | source |
|---|---|---|---|
