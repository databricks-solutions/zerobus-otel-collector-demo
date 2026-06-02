# Zerobus + OpenTelemetry on Databricks

End-to-end demo of using **Databricks** as the observability backend for a Kubernetes cluster:

```
k8s pods ──► OTel Collector ──► Zerobus ──► Delta bronze ──► silver pipelines ──► Databricks App + Genie
```

The repo deploys:
- A Databricks service principal + Unity Catalog bronze tables for OTel logs/metrics/traces.
- An OpenTelemetry Collector + demo app on any Kubernetes cluster, shipping telemetry to Zerobus.
- Spark Declarative Pipelines that refine bronze into queryable silver tables (specifically for the app included in the bundle).
- A full-stack Databricks App with dashboards, bin-packing analysis, and an embedded natural-language assistant (powered by Genie).

## Prerequisites

- A Databricks workspace with **Zerobus enabled** and Unity Catalog
- A Kubernetes cluster you can reach with `kubectl`
- Local tools: `terraform`, `kubectl`, `helm`, `databricks` CLI, `node`/`npm`, `uv`
- A Genie Space (created once in the UI; instructions below)

## Deployment in two commands

### 1. Provision the ingest path

Deploys the OTel Collector to your current `kubectl` context, plus the bronze tables and service principal in your workspace:

```sh
cd tf
cp example.tfvars terraform.tfvars   # then edit databricks_workspace_id + zerobus_catalog
terraform init && terraform apply
```

See `tf/README.md` for the full list of variables and what the module
provisions.

After this, telemetry flows from your cluster into the bronze tables. Verify
(use whatever catalog you set above):

```sql
SELECT count(*) FROM <your-catalog>.otel_bronze.kubernetes_otel_logs;
```

### 2. Deploy the silver pipelines and the app

One-time UI setup (create the Genie Space the assistant queries):
1. **Genie → New Space** → name "OTel Observability"
2. Add tables: `logs_flattened`, `logs_errors`, `bin_packing_pod_efficiency`, `bin_packing_node_summary`
3. Copy the Space ID from the URL

Then a single script builds the frontend, deploys silver pipelines + the app, and applies all the grants:

```sh
cd ../bundle
./deploy.sh dev \
  --var "genie_space_id=<your-genie-space-id>" \
  --var "app_otel_schema=dev_<your_short_name>_kubernetes_otel_silver"
```

For prod (no schema prefix):

```sh
./deploy.sh prod \
  --var "genie_space_id=<your-genie-space-id>"
# app_otel_schema defaults to `kubernetes_otel_silver` in prod
```

> **Catalog note:** the bundle defaults `source_catalog` and `dest_catalog` to
> `otel` in both targets. If you set `zerobus_catalog` to something else in
> the Terraform step, also pass
> `--var "source_catalog=<your-catalog>" --var "dest_catalog=<your-catalog>"`
> so the silver pipelines read from (and write to) the right place.

The script:
- Builds the React frontend via the `frontend_build` bundle script
  (`npm install && npm run build`)
- Runs `databricks bundle deploy` — creates the silver schema, the silver
  pipelines, and the app
- Kicks off the logs and metrics silver pipelines
- App-side grants come from the declarative `resources` in
  `bundle/resources/app.yml` (CAN_USE on the warehouse, CAN_RUN on the Genie
  space, SELECT on each bronze table) and `bundle/resources/schema.yml`
  (USE_SCHEMA + SELECT at the silver schema level)

> **Tip:** to avoid passing `--var` flags every time, create `bundle.local.yml` (gitignored) with target-specific defaults. Or just save the full command in a shell alias.

Run the silver pipelines once they're deployed:

```sh
databricks bundle run logs_silver --target dev
databricks bundle run metrics_silver --target dev
```

Get the app URL:

```sh
databricks apps get otel-observability
```

### Production

For a non-dev rollout (no schema prefix, paused schedules off, shared workspace path):

```sh
databricks bundle deploy --target prod \
  --var "genie_space_id=<genie space id>"
# `app_otel_schema` defaults to `kubernetes_otel_silver` in prod — no override needed
```

## Repo layout

```
bundle/                  # Declarative Automation Bundle
  ├── databricks.yml     # bundle root — variables, includes resources, targets
  ├── deploy.sh          # convenience wrapper around `bundle deploy` + pipeline runs
  ├── app/               # FastAPI backend + React/Vite/TS frontend
  ├── resources/         # bundle resource definitions
  │   ├── job.yml        # init job that creates the bronze tables in UC
  │   ├── schema.yml     # silver schema + app SP grants
  │   ├── logs_pipeline.yml
  │   ├── metrics_pipeline.yml
  │   └── app.yml        # the Databricks App + declarative resource grants
  └── src/               # silver pipeline notebooks + the create_otel_tables init notebook
tf/                      # Terraform: SP + bronze tables + OTel Collector helm release
blog/                    # blog post content
```

## Local development

The app can run outside Databricks for fast iteration:

```sh
cd bundle/app
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
```

## How to get help

Databricks support doesn't cover this content. For questions or bugs, please open a GitHub issue and the team will help on a best-effort basis.

## License

&copy; 2026 Databricks, Inc. All rights reserved. The source in this notebook is provided subject to the Databricks License [https://databricks.com/db-license-source]. All included or referenced third party libraries are subject to the licenses set forth below.

| library | description | license | source |
|---|---|---|---|
