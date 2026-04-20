locals {
  databricks_warehouse_id = length(data.databricks_sql_warehouse.this) > 0 ? data.databricks_sql_warehouse.this[0].id : null
}

data "databricks_sql_warehouse" "this" {
  count = var.warehouse_name == null ? 0 : 1
  name  = var.warehouse_name
}

data "databricks_current_config" "this" {}


# --- Service Principal ---

resource "databricks_service_principal" "zerobus" {
  display_name = var.service_principal_display_name
  active       = true
}

resource "databricks_service_principal_secret" "zerobus" {
  service_principal_id = databricks_service_principal.zerobus.id
}

# --- Schema ---

resource "databricks_schema" "otel" {
  catalog_name = var.zerobus_catalog
  name         = var.zerobus_schema
  comment      = "Schema for Kubernetes OTEL data ingested via Zerobus"
}

# --- Tables ---

resource "databricks_sql_table" "otel_spans" {
  catalog_name = var.zerobus_catalog
  schema_name  = databricks_schema.otel.name
  name         = "${var.table_prefix}_otel_spans"
  table_type   = "MANAGED"
  comment      = "OpenTelemetry spans ingested via Zerobus"
  warehouse_id = local.databricks_warehouse_id


  properties = {
    "otel.schemaVersion" = "v1"
  }

  column {
    name = "trace_id"
    type = "string"
  }
  column {
    name = "span_id"
    type = "string"
  }
  column {
    name = "trace_state"
    type = "string"
  }
  column {
    name = "parent_span_id"
    type = "string"
  }
  column {
    name = "flags"
    type = "int"
  }
  column {
    name = "name"
    type = "string"
  }
  column {
    name = "kind"
    type = "string"
  }
  column {
    name = "start_time_unix_nano"
    type = "bigint"
  }
  column {
    name = "end_time_unix_nano"
    type = "bigint"
  }
  column {
    name = "attributes"
    type = "map<string,string>"
  }
  column {
    name = "dropped_attributes_count"
    type = "int"
  }

  column {
    name = "events"
    type = "array<struct<time_unix_nano:bigint,name:string,attributes:map<string,string>,dropped_attributes_count:int>>"
  }

  column {
    name = "dropped_events_count"
    type = "int"
  }

  column {
    name = "links"
    type = "array<struct<trace_id:string,span_id:string,trace_state:string,attributes:map<string,string>,dropped_attributes_count:int,flags:int>>"
  }

  column {
    name = "dropped_links_count"
    type = "int"
  }

  column {
    name = "status"
    type = "struct<message:string,code:string>"
  }

  column {
    name = "resource"
    type = "struct<attributes:map<string,string>,dropped_attributes_count:int>"
  }

  column {
    name = "resource_schema_url"
    type = "string"
  }

  column {
    name = "instrumentation_scope"
    type = "struct<name:string,version:string,attributes:map<string,string>,dropped_attributes_count:int>"
  }

  column {
    name = "span_schema_url"
    type = "string"
  }
}

resource "databricks_sql_table" "otel_logs" {
  catalog_name = var.zerobus_catalog
  schema_name  = databricks_schema.otel.name
  name         = "${var.table_prefix}_otel_logs"
  table_type   = "MANAGED"
  comment      = "OpenTelemetry logs ingested via Zerobus"
  warehouse_id = local.databricks_warehouse_id

  properties = {
    "otel.schemaVersion" = "v1"
  }

  column {
    name = "event_name"
    type = "string"
  }
  column {
    name = "trace_id"
    type = "string"
  }
  column {
    name = "span_id"
    type = "string"
  }
  column {
    name = "time_unix_nano"
    type = "bigint"
  }
  column {
    name = "observed_time_unix_nano"
    type = "bigint"
  }
  column {
    name = "severity_number"
    type = "string"
  }
  column {
    name = "severity_text"
    type = "string"
  }
  column {
    name = "body"
    type = "string"
  }
  column {
    name = "attributes"
    type = "map<string,string>"
  }
  column {
    name = "dropped_attributes_count"
    type = "int"
  }
  column {
    name = "flags"
    type = "int"
  }

  column {
    name = "resource"
    type = "struct<attributes:map<string,string>,dropped_attributes_count:int>"
  }

  column {
    name = "resource_schema_url"
    type = "string"
  }

  column {
    name = "instrumentation_scope"
    type = "struct<name:string,version:string,attributes:map<string,string>,dropped_attributes_count:int>"
  }

  column {
    name = "log_schema_url"
    type = "string"
  }
}

resource "databricks_sql_table" "otel_metrics" {
  catalog_name = var.zerobus_catalog
  schema_name  = databricks_schema.otel.name
  name         = "${var.table_prefix}_otel_metrics"
  table_type   = "MANAGED"
  comment      = "OpenTelemetry metrics ingested via Zerobus"
  warehouse_id = local.databricks_warehouse_id

  properties = {
    "otel.schemaVersion" = "v1"
  }

  column {
    name = "name"
    type = "string"
  }
  column {
    name = "description"
    type = "string"
  }
  column {
    name = "unit"
    type = "string"
  }
  column {
    name = "metric_type"
    type = "string"
  }

  column {
    name = "gauge"
    type = "struct<start_time_unix_nano:bigint,time_unix_nano:bigint,value:double,exemplars:array<struct<time_unix_nano:bigint,value:double,span_id:string,trace_id:string,filtered_attributes:map<string,string>>>,attributes:map<string,string>,flags:int>"
  }

  column {
    name = "sum"
    type = "struct<start_time_unix_nano:bigint,time_unix_nano:bigint,value:double,exemplars:array<struct<time_unix_nano:bigint,value:double,span_id:string,trace_id:string,filtered_attributes:map<string,string>>>,attributes:map<string,string>,flags:int,aggregation_temporality:string,is_monotonic:boolean>"
  }

  column {
    name = "histogram"
    type = "struct<start_time_unix_nano:bigint,time_unix_nano:bigint,count:bigint,sum:double,bucket_counts:array<bigint>,explicit_bounds:array<double>,exemplars:array<struct<time_unix_nano:bigint,value:double,span_id:string,trace_id:string,filtered_attributes:map<string,string>>>,attributes:map<string,string>,flags:int,min:double,max:double,aggregation_temporality:string>"
  }

  column {
    name = "exponential_histogram"
    type = "struct<attributes:map<string,string>,start_time_unix_nano:bigint,time_unix_nano:bigint,count:bigint,sum:double,scale:int,zero_count:bigint,positive_bucket:struct<offset:int,bucket_counts:array<bigint>>,negative_bucket:struct<offset:int,bucket_counts:array<bigint>>,flags:int,exemplars:array<struct<time_unix_nano:bigint,value:double,span_id:string,trace_id:string,filtered_attributes:map<string,string>>>,min:double,max:double,zero_threshold:double,aggregation_temporality:string>"
  }

  column {
    name = "summary"
    type = "struct<start_time_unix_nano:bigint,time_unix_nano:bigint,count:bigint,sum:double,quantile_values:array<struct<quantile:double,value:double>>,attributes:map<string,string>,flags:int>"
  }

  column {
    name = "metadata"
    type = "map<string,string>"
  }

  column {
    name = "resource"
    type = "struct<attributes:map<string,string>,dropped_attributes_count:int>"
  }

  column {
    name = "resource_schema_url"
    type = "string"
  }

  column {
    name = "instrumentation_scope"
    type = "struct<name:string,version:string,attributes:map<string,string>,dropped_attributes_count:int>"
  }

  column {
    name = "metric_schema_url"
    type = "string"
  }
}

# --- Unity Catalog Grants ---

resource "databricks_grants" "catalog" {
  catalog = var.zerobus_catalog

  grant {
    principal  = databricks_service_principal.zerobus.application_id
    privileges = ["USE_CATALOG"]
  }
}

resource "databricks_grants" "schema" {
  schema = "${var.zerobus_catalog}.${databricks_schema.otel.name}"

  grant {
    principal  = databricks_service_principal.zerobus.application_id
    privileges = ["USE_SCHEMA"]
  }
}

resource "databricks_grants" "otel_spans" {
  table = "${var.zerobus_catalog}.${databricks_schema.otel.name}.${databricks_sql_table.otel_spans.name}"

  grant {
    principal  = databricks_service_principal.zerobus.application_id
    privileges = ["SELECT", "MODIFY"]
  }
}

resource "databricks_grants" "otel_logs" {
  table = "${var.zerobus_catalog}.${databricks_schema.otel.name}.${databricks_sql_table.otel_logs.name}"

  grant {
    principal  = databricks_service_principal.zerobus.application_id
    privileges = ["SELECT", "MODIFY"]
  }
}

resource "databricks_grants" "otel_metrics" {
  table = "${var.zerobus_catalog}.${databricks_schema.otel.name}.${databricks_sql_table.otel_metrics.name}"

  grant {
    principal  = databricks_service_principal.zerobus.application_id
    privileges = ["SELECT", "MODIFY"]
  }
}
