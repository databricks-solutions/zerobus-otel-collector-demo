variable "service_principal_display_name" {
  type        = string
  description = "Display name for the Zerobus service principal"
  default     = "zerobus-otel-collector"
}

variable "zerobus_catalog" {
  type        = string
  description = "Unity Catalog catalog name for Zerobus destination"
  default     = "default"
}

variable "zerobus_schema" {
  type        = string
  description = "Unity Catalog schema name for Zerobus destination"
  default     = "otel_bronze"
}

variable "table_prefix" {
  type        = string
  description = "Prefix for OTEL table names (creates {prefix}_otel_spans, {prefix}_otel_logs, {prefix}_otel_metrics)"
  default     = "kubernetes"
}

variable "warehouse_name" {
  type        = string
  description = "Warehouse to use for creating Unity Catalog tables"
  default     = null
}

variable "databricks_region" {
  type        = string
  default     = null
  description = "Override the workspace region used for the Zerobus gRPC endpoint (e.g. us-west-2). Defaults to the current metastore's region."
}

variable "databricks_workspace_id" {
  type        = string
  description = "ID of the Databricks workspace"
}
