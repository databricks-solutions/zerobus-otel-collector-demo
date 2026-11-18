locals {
  databricks_workspace_url = data.databricks_current_config.this.host
  databricks_client_id     = databricks_service_principal.zerobus.application_id
  databricks_client_secret = databricks_service_principal_secret.zerobus.secret
  zerobus_host_suffix = {
    azure = "azuredatabricks.net"
    aws   = "cloud.databricks.com"
    gcp   = "gcp.databricks.com"
  }[data.databricks_current_config.this.cloud_type]
  databricks_region = coalesce(var.databricks_region, data.databricks_current_metastore.this.metastore_info[0].region)
  zerobus_endpoint  = "${var.databricks_workspace_id}.zerobus.${local.databricks_region}.${local.zerobus_host_suffix}:443"
  zerobus_resource  = "api://databricks/workspaces/${var.databricks_workspace_id}/zerobusDirectWriteApi"

  otel_logs_table    = "${var.zerobus_catalog}.${databricks_schema.otel.name}.${databricks_sql_table.otel_logs.name}"
  otel_metrics_table = "${var.zerobus_catalog}.${databricks_schema.otel.name}.${databricks_sql_table.otel_metrics.name}"
  otel_spans_table   = "${var.zerobus_catalog}.${databricks_schema.otel.name}.${databricks_sql_table.otel_spans.name}"

  # OAuth authorization_details JSON per signal — scopes the token to one UC table.
  auth_details = {
    spans   = local.otel_spans_table
    logs    = local.otel_logs_table
    metrics = local.otel_metrics_table
  }
  # Commas escaped because helm's strvals parser (used by `set`) splits values on them.
  auth_details_json = {
    for signal, table in local.auth_details : signal => replace(jsonencode([
      {
        type             = "unity_catalog_privileges"
        privileges       = ["USE CATALOG"]
        object_type      = "CATALOG"
        object_full_path = var.zerobus_catalog
      },
      {
        type             = "unity_catalog_privileges"
        privileges       = ["USE SCHEMA"]
        object_type      = "SCHEMA"
        object_full_path = "${var.zerobus_catalog}.${databricks_schema.otel.name}"
      },
      {
        type             = "unity_catalog_privileges"
        privileges       = ["SELECT", "MODIFY"]
        object_type      = "TABLE"
        object_full_path = table
      },
    ]), ",", "\\,")
  }
}

# Namespace + Secret for the OTel Collector

resource "kubernetes_namespace_v1" "otel" {
  metadata {
    name = "otel"
  }
}

resource "kubernetes_secret_v1" "databricks_sp" {
  metadata {
    name      = "databricks-sp"
    namespace = kubernetes_namespace_v1.otel.metadata[0].name
  }
  type = "Opaque"
  data = {
    client_id     = local.databricks_client_id
    client_secret = local.databricks_client_secret
  }
}

# OpenTelemetry Collector
resource "helm_release" "otel_collector" {
  name       = "otel-collector"
  repository = "https://open-telemetry.github.io/opentelemetry-helm-charts"
  chart      = "opentelemetry-collector"
  namespace  = kubernetes_namespace_v1.otel.metadata[0].name
  atomic     = false

  # extraEnvs is fully owned here (replaces the illustrative list in otel-collector-values.yaml).
  # WORKSPACE_URL feeds all three oauth2client/*.token_url; ZEROBUS_ENDPOINT feeds all three
  # otlp/databricks-*.endpoint; ZEROBUS_RESOURCE feeds all three oauth2client/*.endpoint_params.resource.
  values = [
    file("${path.module}/otel-collector-values.yaml"),
    yamlencode({
      extraEnvs = [
        { name = "DATABRICKS_CLIENT_ID", valueFrom = { secretKeyRef = { name = kubernetes_secret_v1.databricks_sp.metadata[0].name, key = "client_id" } } },
        { name = "DATABRICKS_CLIENT_SECRET", valueFrom = { secretKeyRef = { name = kubernetes_secret_v1.databricks_sp.metadata[0].name, key = "client_secret" } } },
        { name = "WORKSPACE_URL", value = local.databricks_workspace_url },
        { name = "ZEROBUS_ENDPOINT", value = local.zerobus_endpoint },
        { name = "ZEROBUS_RESOURCE", value = local.zerobus_resource },
      ]
    }),
  ]

  set = [
    # Per-table authorization_details JSON (forced string to preserve JSON literal)
    {
      name  = "config.extensions.oauth2client/spans.endpoint_params.authorization_details[0]"
      value = local.auth_details_json.spans
      type  = "string"
    },
    {
      name  = "config.extensions.oauth2client/logs.endpoint_params.authorization_details[0]"
      value = local.auth_details_json.logs
      type  = "string"
    },
    {
      name  = "config.extensions.oauth2client/metrics.endpoint_params.authorization_details[0]"
      value = local.auth_details_json.metrics
      type  = "string"
    },
    # Per-signal table name headers
    {
      name  = "config.exporters.otlp/databricks-spans.headers.x-databricks-zerobus-table-name"
      value = local.otel_spans_table
    },
    {
      name  = "config.exporters.otlp/databricks-logs.headers.x-databricks-zerobus-table-name"
      value = local.otel_logs_table
    },
    {
      name  = "config.exporters.otlp/databricks-metrics.headers.x-databricks-zerobus-table-name"
      value = local.otel_metrics_table
    },
  ]

  depends_on = [kubernetes_secret_v1.databricks_sp]
}

# OpenTelemetry Demo App
resource "helm_release" "otel_demo" {
  name             = "otel-demo"
  repository       = "https://open-telemetry.github.io/opentelemetry-helm-charts"
  chart            = "opentelemetry-demo"
  version          = "0.40.9" # demo app 2.2.0
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
    # Mitigate CVE-2026-114938 (Java4Shell) in the JVM services (ad, fraud-detection, kafka) by
    # disabling the vulnerable Base64 JIT intrinsic. JDK_JAVA_OPTIONS rather than JAVA_TOOL_OPTIONS,
    # since the images already use the latter to load the OTel Java agent. No-op for non-JVM services.
    {
      name  = "default.envOverrides[1].name"
      value = "JDK_JAVA_OPTIONS"
    },
    {
      name  = "default.envOverrides[1].value"
      value = "-XX:-UseBASE64Intrinsics"
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