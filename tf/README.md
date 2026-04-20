# Fluent Bit to Databricks Zerobus (Minikube)

Deploys Fluent Bit on a local minikube cluster to forward Kubernetes logs to Databricks Zerobus.

## Prerequisites

- [minikube](https://minikube.sigs.k8s.io/) running locally (`minikube start`)
- Terraform installed
- `jq` installed (for token script)
- Databricks workspace with Zerobus enabled
- A Databricks PAT (workspace admin) for creating service principals and granting permissions

## Setup

1. Start minikube:
   ```sh
   minikube start
   ```

2. Copy and edit the tfvars file:
   ```sh
   cp local.auto.tfvars.example local.auto.tfvars
   # Edit with your workspace ID and URL
   ```

3. Set your admin token (used by the Databricks Terraform provider):
   ```sh
   export DATABRICKS_TOKEN="dapi..."
   ```

4. Deploy (creates the service principal, grants UC permissions, and deploys Helm charts):
   ```sh
   terraform init
   terraform apply
   ```

5. Generate an OAuth token (optional, for manual testing with Fluent Bit):
   ```sh
   source token.sh
   echo $OAUTH_TOKEN
   ```

## Configuration

| Variable | Description | Default |
|---|---|---|
| `databricks_admin_token` | PAT for admin operations (or set `DATABRICKS_TOKEN` env var) | `null` |
| `databricks_workspace_id` | Workspace ID | - |
| `databricks_workspace_url` | Workspace URL | - |
| `service_principal_display_name` | Display name for the created SP | `zerobus-otel-collector` |
| `zerobus_catalog` | Unity Catalog catalog | `default` |
| `zerobus_schema` | Unity Catalog schema | `kubernetes_logs` |
| `zerobus_table` | Unity Catalog table | `raw` |

## Architecture

Terraform creates a Databricks service principal with OAuth credentials and grants it Unity Catalog permissions on the target table. The OTel Collector uses these credentials for OAuth2 client-credentials auth. Fluent Bit and the OTel Collector run as DaemonSets on the minikube node, collecting container logs and forwarding them to the Databricks Zerobus HTTP ingestion endpoint.