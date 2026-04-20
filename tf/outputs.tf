output "otel_collector_namespace" {
  value       = helm_release.otel_collector.namespace
  description = "Namespace where the OpenTelemetry Collector is deployed"
}

output "service_principal_application_id" {
  value       = databricks_service_principal.zerobus.application_id
  description = "OAuth Client ID for the Zerobus service principal"
}

output "service_principal_secret" {
  value       = databricks_service_principal_secret.zerobus.secret
  description = "OAuth Client Secret for the Zerobus service principal"
  sensitive   = true
}

output "otel_table_names" {
  value = {
    spans   = databricks_sql_table.otel_spans.name
    logs    = databricks_sql_table.otel_logs.name
    metrics = databricks_sql_table.otel_metrics.name
  }
  description = "Names of the created OTEL tables"
}