"""Bin-packing analysis endpoints — request-vs-usage gap analytics.

Uses the silver tables `container_resource_spec` (latest spec per container) and
`pod_compute` (time-series usage), recomputing pod-level p95 over a configurable
time window. The materialized `bin_packing_pod_efficiency` view is a useful
all-time baseline for ad-hoc SQL but isn't used by these endpoints, since users
need windowed analysis for "is this still over-provisioned today?" questions.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..config import fq
from ..sql import execute_statement, to_params

router = APIRouter(prefix="/api/binpacking", tags=["binpacking"])


# ----- helpers ---------------------------------------------------------------


def _parse_iso(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        return datetime.fromisoformat(s)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"invalid datetime: {s} ({e})")


def _resolve_window(
    from_iso: Optional[str], to_iso: Optional[str]
) -> tuple[datetime, datetime]:
    to_dt = _parse_iso(to_iso) or datetime.now(timezone.utc)
    from_dt = _parse_iso(from_iso) or (to_dt - timedelta(hours=24))
    if from_dt >= to_dt:
        raise HTTPException(status_code=400, detail="`from` must be before `to`")
    return from_dt, to_dt


def _windowed_pod_efficiency_cte(namespace: Optional[str]) -> tuple[str, dict]:
    """Build a CTE chain that recomputes pod efficiency over the time window.

    Bound parameters: :from_ts, :to_ts, optionally :ns.
    Yields a CTE result aliased `eff` with the same column shape as the
    materialized `bin_packing_pod_efficiency` view.
    """
    ns_filter_compute = "AND namespace = :ns" if namespace else ""
    ns_filter_spec = "AND namespace = :ns" if namespace else ""
    cte = f"""
        WITH pod_usage_windowed AS (
            SELECT
              namespace, pod, pod_uid, node, deployment, service, metric_domain,
              percentile_approx(value, 0.95) AS p95,
              avg(value) AS avg_v,
              max(value) AS max_v
            FROM {fq('pod_compute')}
            WHERE metric_short_name = 'usage'
              AND timestamp >= :from_ts AND timestamp < :to_ts
              {ns_filter_compute}
            GROUP BY namespace, pod, pod_uid, node, deployment, service, metric_domain
        ),
        pod_usage AS (
            SELECT
              namespace, pod, pod_uid, node, deployment, service,
              MAX(CASE WHEN metric_domain = 'cpu' THEN p95 END)    AS cpu_p95_cores,
              MAX(CASE WHEN metric_domain = 'cpu' THEN avg_v END)  AS cpu_avg_cores,
              MAX(CASE WHEN metric_domain = 'cpu' THEN max_v END)  AS cpu_max_cores,
              MAX(CASE WHEN metric_domain = 'memory' THEN p95 END)   AS memory_p95_bytes,
              MAX(CASE WHEN metric_domain = 'memory' THEN avg_v END) AS memory_avg_bytes,
              MAX(CASE WHEN metric_domain = 'memory' THEN max_v END) AS memory_max_bytes
            FROM pod_usage_windowed
            GROUP BY namespace, pod, pod_uid, node, deployment, service
        ),
        pod_spec AS (
            SELECT
              namespace, pod, pod_uid, node,
              SUM(cpu_request_cores)    AS cpu_request_cores,
              SUM(cpu_limit_cores)      AS cpu_limit_cores,
              SUM(memory_request_bytes) AS memory_request_bytes,
              SUM(memory_limit_bytes)   AS memory_limit_bytes
            FROM {fq('container_resource_spec')}
            WHERE 1=1 {ns_filter_spec}
            GROUP BY namespace, pod, pod_uid, node
        ),
        eff AS (
            SELECT
              s.namespace, s.pod, s.pod_uid, s.node,
              u.deployment, u.service,
              s.cpu_request_cores, s.cpu_limit_cores,
              s.memory_request_bytes, s.memory_limit_bytes,
              u.cpu_p95_cores, u.cpu_avg_cores, u.cpu_max_cores,
              u.memory_p95_bytes, u.memory_avg_bytes, u.memory_max_bytes,
              CASE WHEN s.cpu_request_cores > 0
                   THEN ROUND(u.cpu_p95_cores * 100.0 / s.cpu_request_cores, 1) END AS cpu_efficiency_pct,
              CASE WHEN s.memory_request_bytes > 0
                   THEN ROUND(u.memory_p95_bytes * 100.0 / s.memory_request_bytes, 1) END AS memory_efficiency_pct,
              CASE WHEN s.cpu_request_cores IS NOT NULL AND u.cpu_p95_cores IS NOT NULL
                   THEN GREATEST(s.cpu_request_cores - u.cpu_p95_cores, 0.0) END AS cpu_waste_cores,
              CASE WHEN s.memory_request_bytes IS NOT NULL AND u.memory_p95_bytes IS NOT NULL
                   THEN GREATEST(s.memory_request_bytes - u.memory_p95_bytes, 0.0) END AS memory_waste_bytes
            FROM pod_spec s
            LEFT JOIN pod_usage u
              ON s.namespace = u.namespace AND s.pod = u.pod
             AND s.pod_uid = u.pod_uid AND s.node = u.node
        )
    """
    params: dict = {}
    if namespace:
        params["ns"] = namespace
    return cte, params


# ----- endpoints -------------------------------------------------------------


@router.get("/summary")
async def summary(
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = Query(None),
    namespace: Optional[str] = Query(None),
):
    """Cluster-wide bin-packing KPIs over the chosen time window."""
    from_dt, to_dt = _resolve_window(from_, to)
    cte, ns_params = _windowed_pod_efficiency_cte(namespace)
    sql = f"""
        {cte}
        SELECT
          COUNT(*) AS pod_count,
          COALESCE(SUM(cpu_request_cores), 0)        AS cpu_requested_cores,
          COALESCE(SUM(cpu_p95_cores), 0)            AS cpu_used_p95_cores,
          COALESCE(SUM(cpu_waste_cores), 0)          AS cpu_waste_cores,
          COALESCE(SUM(memory_request_bytes), 0)     AS memory_requested_bytes,
          COALESCE(SUM(memory_p95_bytes), 0)         AS memory_used_p95_bytes,
          COALESCE(SUM(memory_waste_bytes), 0)       AS memory_waste_bytes,
          SUM(CASE WHEN cpu_efficiency_pct < 25 THEN 1 ELSE 0 END)    AS over_provisioned_cpu_count,
          SUM(CASE WHEN memory_efficiency_pct < 25 THEN 1 ELSE 0 END) AS over_provisioned_mem_count
        FROM eff
    """
    params = {**ns_params, "from_ts": from_dt.isoformat(), "to_ts": to_dt.isoformat()}
    try:
        result = await execute_statement(sql, parameters=to_params(params))
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    row = result["rows"][0] if result["rows"] else {}

    def f(k):
        v = row.get(k)
        try:
            return float(v) if v is not None else 0.0
        except (TypeError, ValueError):
            return 0.0

    cpu_req = f("cpu_requested_cores")
    cpu_used = f("cpu_used_p95_cores")
    mem_req = f("memory_requested_bytes")
    mem_used = f("memory_used_p95_bytes")

    return {
        "pod_count": int(f("pod_count")),
        "cpu_requested_cores": cpu_req,
        "cpu_used_p95_cores": cpu_used,
        "cpu_waste_cores": f("cpu_waste_cores"),
        "cpu_efficiency_pct": round((cpu_used / cpu_req * 100.0), 1) if cpu_req > 0 else None,
        "cpu_waste_pct": round((1 - cpu_used / cpu_req) * 100.0, 1) if cpu_req > 0 else None,
        "memory_requested_bytes": mem_req,
        "memory_used_p95_bytes": mem_used,
        "memory_waste_bytes": f("memory_waste_bytes"),
        "memory_efficiency_pct": round((mem_used / mem_req * 100.0), 1) if mem_req > 0 else None,
        "memory_waste_pct": round((1 - mem_used / mem_req) * 100.0, 1) if mem_req > 0 else None,
        "over_provisioned_cpu_count": int(f("over_provisioned_cpu_count")),
        "over_provisioned_mem_count": int(f("over_provisioned_mem_count")),
        "from": from_dt.isoformat(),
        "to": to_dt.isoformat(),
    }


@router.get("/node-utilization")
async def node_utilization(
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = Query(None),
    namespace: Optional[str] = Query(None),
):
    """Per-node summary over the chosen window. Capacity is lifetime baseline (rarely changes)."""
    from_dt, to_dt = _resolve_window(from_, to)
    cte, ns_params = _windowed_pod_efficiency_cte(namespace)
    sql = f"""
        {cte}
        ,
        by_node AS (
            SELECT
              node,
              COUNT(*) AS pod_count,
              SUM(cpu_request_cores) AS cpu_requested_cores,
              SUM(memory_request_bytes) AS memory_requested_bytes,
              SUM(cpu_p95_cores) AS cpu_used_p95_cores,
              SUM(memory_p95_bytes) AS memory_used_p95_bytes,
              SUM(cpu_waste_cores) AS cpu_waste_cores,
              SUM(memory_waste_bytes) AS memory_waste_bytes
            FROM eff
            WHERE node IS NOT NULL
            GROUP BY node
        )
        SELECT
          n.node,
          n.pod_count,
          c.cpu_capacity_cores,
          n.cpu_requested_cores,
          n.cpu_used_p95_cores,
          CASE WHEN c.cpu_capacity_cores > 0
               THEN ROUND(n.cpu_requested_cores * 100.0 / c.cpu_capacity_cores, 1) END AS cpu_request_pct_of_capacity,
          CASE WHEN c.cpu_capacity_cores > 0
               THEN ROUND(n.cpu_used_p95_cores * 100.0 / c.cpu_capacity_cores, 1) END AS cpu_usage_pct_of_capacity,
          c.memory_capacity_bytes_estimate,
          n.memory_requested_bytes,
          n.memory_used_p95_bytes,
          CASE WHEN c.memory_capacity_bytes_estimate > 0
               THEN ROUND(n.memory_requested_bytes * 100.0 / c.memory_capacity_bytes_estimate, 1) END AS memory_request_pct_of_capacity,
          CASE WHEN c.memory_capacity_bytes_estimate > 0
               THEN ROUND(n.memory_used_p95_bytes * 100.0 / c.memory_capacity_bytes_estimate, 1) END AS memory_usage_pct_of_capacity
        FROM by_node n
        LEFT JOIN {fq('node_capacity_estimated')} c USING (node)
        ORDER BY n.pod_count DESC
    """
    params = {**ns_params, "from_ts": from_dt.isoformat(), "to_ts": to_dt.isoformat()}
    try:
        result = await execute_statement(sql, parameters=to_params(params))
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"rows": result["rows"]}


@router.get("/over-provisioned")
async def over_provisioned(
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=200),
    namespace: Optional[str] = Query(None),
    resource: str = Query("cpu", pattern="^(cpu|memory)$"),
):
    """Top pods with the largest gap between request and p95 actual usage in the window."""
    from_dt, to_dt = _resolve_window(from_, to)
    cte, ns_params = _windowed_pod_efficiency_cte(namespace)

    if resource == "cpu":
        order_col = "cpu_waste_cores"
        request_col = "cpu_request_cores"
        used_col = "cpu_p95_cores"
        eff_col = "cpu_efficiency_pct"
    else:
        order_col = "memory_waste_bytes"
        request_col = "memory_request_bytes"
        used_col = "memory_p95_bytes"
        eff_col = "memory_efficiency_pct"

    sql = f"""
        {cte}
        SELECT
          namespace,
          pod,
          deployment,
          service,
          node,
          {request_col} AS request,
          {used_col} AS used_p95,
          {order_col} AS waste,
          {eff_col} AS efficiency_pct
        FROM eff
        WHERE {request_col} > 0 AND {order_col} IS NOT NULL
        ORDER BY {order_col} DESC
        LIMIT {int(limit)}
    """
    params = {**ns_params, "from_ts": from_dt.isoformat(), "to_ts": to_dt.isoformat()}
    try:
        result = await execute_statement(sql, parameters=to_params(params))
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"rows": result["rows"], "resource": resource}


@router.get("/consolidation")
async def consolidation(
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = Query(None),
    cpu_threshold_pct: float = Query(40.0, ge=0, le=100),
    memory_threshold_pct: float = Query(50.0, ge=0, le=100),
):
    """Nodes whose p95 utilization in the chosen window stayed below thresholds."""
    from_dt, to_dt = _resolve_window(from_, to)
    cte, _ = _windowed_pod_efficiency_cte(None)
    sql = f"""
        {cte}
        ,
        by_node AS (
            SELECT
              node,
              COUNT(*) AS pod_count,
              SUM(cpu_request_cores) AS cpu_requested_cores,
              SUM(memory_request_bytes) AS memory_requested_bytes,
              SUM(cpu_p95_cores) AS cpu_used_p95_cores,
              SUM(memory_p95_bytes) AS memory_used_p95_bytes
            FROM eff
            WHERE node IS NOT NULL
            GROUP BY node
        )
        SELECT
          n.node,
          n.pod_count,
          c.cpu_capacity_cores,
          n.cpu_used_p95_cores,
          CASE WHEN c.cpu_capacity_cores > 0
               THEN ROUND(n.cpu_used_p95_cores * 100.0 / c.cpu_capacity_cores, 1) END AS cpu_usage_pct_of_capacity,
          c.memory_capacity_bytes_estimate,
          n.memory_used_p95_bytes,
          CASE WHEN c.memory_capacity_bytes_estimate > 0
               THEN ROUND(n.memory_used_p95_bytes * 100.0 / c.memory_capacity_bytes_estimate, 1) END AS memory_usage_pct_of_capacity,
          n.cpu_requested_cores,
          n.memory_requested_bytes,
          CASE WHEN c.cpu_capacity_cores > 0
               THEN ROUND(n.cpu_requested_cores * 100.0 / c.cpu_capacity_cores, 1) END AS cpu_request_pct_of_capacity,
          CASE WHEN c.memory_capacity_bytes_estimate > 0
               THEN ROUND(n.memory_requested_bytes * 100.0 / c.memory_capacity_bytes_estimate, 1) END AS memory_request_pct_of_capacity
        FROM by_node n
        LEFT JOIN {fq('node_capacity_estimated')} c USING (node)
        WHERE COALESCE(
                CASE WHEN c.cpu_capacity_cores > 0
                     THEN n.cpu_used_p95_cores * 100.0 / c.cpu_capacity_cores END, 0) < :cpu_th
          AND COALESCE(
                CASE WHEN c.memory_capacity_bytes_estimate > 0
                     THEN n.memory_used_p95_bytes * 100.0 / c.memory_capacity_bytes_estimate END, 0) < :mem_th
        ORDER BY cpu_usage_pct_of_capacity ASC
    """
    params = {
        "from_ts": from_dt.isoformat(),
        "to_ts": to_dt.isoformat(),
        "cpu_th": cpu_threshold_pct,
        "mem_th": memory_threshold_pct,
    }
    try:
        result = await execute_statement(sql, parameters=to_params(params))
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {
        "rows": result["rows"],
        "cpu_threshold_pct": cpu_threshold_pct,
        "memory_threshold_pct": memory_threshold_pct,
    }


@router.get("/pod-efficiency")
async def pod_efficiency(
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = Query(None),
    namespace: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
):
    """Full per-pod efficiency table over the window (for the leaderboard / scatter view)."""
    from_dt, to_dt = _resolve_window(from_, to)
    cte, ns_params = _windowed_pod_efficiency_cte(namespace)
    sql = f"""
        {cte}
        SELECT
          namespace,
          pod,
          deployment,
          service,
          node,
          cpu_request_cores,
          cpu_p95_cores,
          cpu_efficiency_pct,
          cpu_waste_cores,
          memory_request_bytes,
          memory_p95_bytes,
          memory_efficiency_pct,
          memory_waste_bytes
        FROM eff
        ORDER BY GREATEST(COALESCE(cpu_waste_cores, 0), COALESCE(memory_waste_bytes / 1e9, 0)) DESC
        LIMIT {int(limit)}
    """
    params = {**ns_params, "from_ts": from_dt.isoformat(), "to_ts": to_dt.isoformat()}
    try:
        result = await execute_statement(sql, parameters=to_params(params))
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"rows": result["rows"]}
