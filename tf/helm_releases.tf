locals {
  databricks_workspace_url = data.databricks_current_config.this.host
  databricks_workspace_id  = data.databricks_current_config.this.id
  databricks_client_id     = databricks_service_principal.zerobus.application_id
  databricks_client_secret = databricks_service_principal_secret.zerobus.secret
  otel_endpoint            = "${local.databricks_workspace_url}/api/2.0/otel"
  otel_token_url           = "${local.databricks_workspace_url}/oidc/v1/token"
  otel_audience            = "api://databricks/workspaces/${local.databricks_workspace_id}/zerobusDirectWriteApi"
  otel_logs_table          = "${var.zerobus_catalog}.${databricks_schema.otel.name}.${databricks_sql_table.otel_logs.name}"
  otel_metrics_table       = "${var.zerobus_catalog}.${databricks_schema.otel.name}.${databricks_sql_table.otel_metrics.name}"
  otel_spans_table         = "${var.zerobus_catalog}.${databricks_schema.otel.name}.${databricks_sql_table.otel_spans.name}"
}

# OpenTelemetry Collector
resource "helm_release" "otel_collector" {
  name             = "otel-collector"
  repository       = "https://open-telemetry.github.io/opentelemetry-helm-charts"
  chart            = "opentelemetry-collector"
  namespace        = "otel"
  create_namespace = true
  atomic           = true

  values = [file("${path.module}/otel-collector-values.yaml")]

  set = [
    # OAuth2 extension
    {
      name  = "config.extensions.oauth2client.client_id"
      value = local.databricks_client_id
    },
    {
      name  = "config.extensions.oauth2client.token_url"
      value = local.otel_token_url
    },
    {
      name  = "config.extensions.oauth2client.audience"
      value = local.otel_audience
    },
    # Exporter endpoints
    {
      name  = "config.exporters.otlphttp/databricks-logs.endpoint"
      value = local.otel_endpoint
    },
    {
      name  = "config.exporters.otlphttp/databricks-metrics.endpoint"
      value = local.otel_endpoint
    },
    {
      name  = "config.exporters.otlphttp/databricks-spans.endpoint"
      value = local.otel_endpoint
    },
    # UC table name headers
    {
      name  = "config.exporters.otlphttp/databricks-logs.headers.X-Databricks-UC-Table-Name"
      value = local.otel_logs_table
    },
    {
      name  = "config.exporters.otlphttp/databricks-metrics.headers.X-Databricks-UC-Table-Name"
      value = local.otel_metrics_table
    },
    {
      name  = "config.exporters.otlphttp/databricks-spans.headers.X-Databricks-UC-Table-Name"
      value = local.otel_spans_table
    },
  ]

  set_sensitive = [
    {
      name  = "config.extensions.oauth2client.client_secret"
      value = local.databricks_client_secret
    },
  ]

  set_list = [
    {
      name  = "config.extensions.oauth2client.scopes"
      value = ["all-apis"]
    },
  ]
}

# OpenTelemetry Demo App
resource "helm_release" "otel_demo" {
  name             = "otel-demo"
  repository       = "https://open-telemetry.github.io/opentelemetry-helm-charts"
  chart            = "opentelemetry-demo"
  namespace        = "otel-demo"
  create_namespace = true
  wait             = true
  timeout          = 900

  set = [
    # Point demo services at our collector via OTEL_COLLECTOR_NAME
    # (each service builds its own endpoint URL using this + its preferred port)
    {
      name  = "default.envOverrides[0].name"
      value = "OTEL_COLLECTOR_NAME"
    },
    {
      name  = "default.envOverrides[0].value"
      value = "otel-collector-opentelemetry-collector.${helm_release.otel_collector.namespace}.svc.cluster.local"
    },
    # Disable bundled collector — we use our own
    {
      name  = "opentelemetry-collector.enabled"
      value = "false"
    },
    # Disable bundled backends
    {
      name  = "jaeger.enabled"
      value = "false"
    },
    {
      name  = "prometheus.enabled"
      value = "false"
    },
    {
      name  = "grafana.enabled"
      value = "false"
    },
    {
      name  = "opensearch.enabled"
      value = "false"
    },
  ]
}