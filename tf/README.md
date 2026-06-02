# Terraform: Zerobus ingest path

Deploys the OpenTelemetry Collector to a Kubernetes cluster and wires it up
to Databricks Zerobus. Creates everything the collector needs in the
workspace — a service principal, a bronze schema, and three Delta tables for
OTel spans, logs, and metrics — and configures three signal-scoped OAuth2
client extensions on the collector for token-level least privilege.

## What this module provisions

In your **Databricks workspace** (via the `databricks` provider):
- A service principal + OAuth client secret for the collector.
- A schema `<zerobus_catalog>.<zerobus_schema>` (default schema: `otel_bronze`).
- Three Delta tables (`<table_prefix>_otel_spans`, `<table_prefix>_otel_logs`,
  `<table_prefix>_otel_metrics`) with variant-typed attribute bags and
  variant shredding enabled.
- UC grants on those tables for the service principal.

On the **Kubernetes cluster** `kubectl` is currently pointed at (via the `helm` and `kubernetes` providers):
- An `otel` namespace and a Kubernetes Secret holding the SP credentials.
- The `opentelemetry-collector` Helm chart in DaemonSet mode, configured to
  send logs/metrics/traces to Zerobus over OTLP/gRPC with three per-signal
  OAuth2 client extensions.
- The `opentelemetry-demo` Helm chart (with the bundled jaeger / grafana /
  prometheus / opensearch backends disabled), pointed at our collector for
  workload telemetry.

## Prerequisites

- A Kubernetes cluster reachable via your current `kubectl` context
- A Databricks workspace with Zerobus enabled + Unity Catalog
- Auth for the Databricks provider — typically `DATABRICKS_HOST` +
  `DATABRICKS_TOKEN` in your environment
- Terraform ≥ 1.5, `kubectl`, `helm`

## Usage

```sh
# 1. Copy the example tfvars and fill in the two required values.
cp example.tfvars local.auto.tfvars
# edit databricks_workspace_id + zerobus_catalog

# 2. Apply.
terraform init
terraform apply
```

Only two variables are required (`databricks_workspace_id` and
`zerobus_catalog`); everything else has a sensible default or is
auto-detected. See `example.tfvars` for the full set of optional overrides.

After apply, telemetry should be flowing into the bronze tables within a
minute or two. Verify:

```sql
SELECT count(*) FROM <zerobus_catalog>.otel_bronze.kubernetes_otel_logs;
```

## Variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `databricks_workspace_id` | yes | — | Numeric workspace ID — used in the Zerobus endpoint hostname and the OAuth `resource` |
| `zerobus_catalog` | yes | — | UC catalog the bronze schema lives in |
| `zerobus_schema` | no | `otel_bronze` | Schema name |
| `table_prefix` | no | `kubernetes` | Bronze table name prefix |
| `databricks_region` | no | metastore region | Override only if your workspace region differs from your metastore region |
| `service_principal_display_name` | no | `zerobus-otel-collector` | SP display name |
| `warehouse_name` | no | `null` | If set, the SP is granted CAN_USE on this warehouse |

## How auth is wired

The collector configures **three** `oauth2client` extensions — one per
signal. Each requests a token whose `authorization_details` claim scopes UC
privileges to exactly that signal's bronze table: `USE CATALOG` +
`USE SCHEMA` + `SELECT` + `MODIFY` on the spans table for the spans
extension, and the same for logs and metrics on their respective tables. A
token issued for one signal can't write to another signal's table.

The Zerobus endpoint host
(`<workspace_id>.zerobus.<region>.<cloud_suffix>:443`) is assembled from the
`databricks_current_config` and `databricks_current_metastore` data sources
at plan time, so the same module works on AWS, Azure, and GCP without
manual config.

## Tear-down

```sh
terraform destroy
```