"""Dashboard endpoints — backed by SQL Warehouse Statement Execution API."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..config import fq
from ..sql import execute_statement, to_params

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


# ----- helpers ---------------------------------------------------------------


def _parse_iso(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        # Accept trailing Z
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        return datetime.fromisoformat(s)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"invalid datetime: {s} ({e})")


def _resolve_window(
    from_iso: Optional[str], to_iso: Optional[str]
) -> tuple[datetime, datetime]:
    to_dt = _parse_iso(to_iso) or datetime.now(timezone.utc)
    from_dt = _parse_iso(from_iso) or (to_dt - timedelta(hours=1))
    if from_dt >= to_dt:
        raise HTTPException(status_code=400, detail="`from` must be before `to`")
    return from_dt, to_dt


def _bucket_seconds(window: timedelta) -> int:
    """Pick a sensible time bucket size for the window.

    < 2h  -> 60s (minute)
    < 2d  -> 3600s (hour)
    else  -> 86400s (day)
    """
    total = window.total_seconds()
    if total < 2 * 3600:
        return 60
    if total < 2 * 86400:
        return 3600
    return 86400


# ----- endpoints -------------------------------------------------------------


@router.get("/namespaces")
async def list_namespaces():
    sql = (
        f"SELECT DISTINCT namespace FROM {fq('logs_flattened')} "
        f"WHERE namespace IS NOT NULL "
        f"ORDER BY namespace"
    )
    try:
        result = await execute_statement(sql, row_limit=1000)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    namespaces = [r["namespace"] for r in result["rows"] if r.get("namespace")]
    return {"namespaces": namespaces}


@router.get("/summary")
async def summary(
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = Query(None),
    namespace: Optional[str] = Query(None),
):
    from_dt, to_dt = _resolve_window(from_, to)

    where = "log_timestamp >= :from_ts AND log_timestamp < :to_ts"
    params = {"from_ts": from_dt.isoformat(), "to_ts": to_dt.isoformat()}
    if namespace:
        where += " AND namespace = :ns"
        params["ns"] = namespace

    sql = f"""
        SELECT
          COUNT(*) AS total_logs,
          SUM(CASE WHEN parsed_severity IN ('ERROR','FATAL') THEN 1 ELSE 0 END) AS error_count,
          SUM(CASE WHEN parsed_severity = 'WARN' THEN 1 ELSE 0 END) AS warn_count,
          COUNT(DISTINCT pod) AS distinct_pods,
          COUNT(DISTINCT service) AS distinct_services,
          COUNT(DISTINCT namespace) AS distinct_namespaces
        FROM {fq('logs_flattened')}
        WHERE {where}
    """
    try:
        result = await execute_statement(sql, parameters=to_params(params))
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    row = result["rows"][0] if result["rows"] else {}

    def _i(v):
        try:
            return int(v) if v is not None else 0
        except (TypeError, ValueError):
            return 0

    total = _i(row.get("total_logs"))
    errors = _i(row.get("error_count"))
    rate = (errors / total) if total else 0.0
    return {
        "total_logs": total,
        "error_count": errors,
        "warn_count": _i(row.get("warn_count")),
        "error_rate": rate,
        "distinct_pods": _i(row.get("distinct_pods")),
        "distinct_services": _i(row.get("distinct_services")),
        "distinct_namespaces": _i(row.get("distinct_namespaces")),
        "from": from_dt.isoformat(),
        "to": to_dt.isoformat(),
    }


@router.get("/log-volume")
async def log_volume(
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = Query(None),
    namespace: Optional[str] = Query(None),
):
    from_dt, to_dt = _resolve_window(from_, to)
    bucket_sec = _bucket_seconds(to_dt - from_dt)

    where = "log_timestamp >= :from_ts AND log_timestamp < :to_ts"
    params = {
        "from_ts": from_dt.isoformat(),
        "to_ts": to_dt.isoformat(),
        "bucket_sec": bucket_sec,
    }
    if namespace:
        where += " AND namespace = :ns"
        params["ns"] = namespace

    # Bucket using floor on epoch seconds
    sql = f"""
        SELECT
          TIMESTAMP_SECONDS(
            CAST(FLOOR(UNIX_TIMESTAMP(log_timestamp) / :bucket_sec) * :bucket_sec AS BIGINT)
          ) AS bucket,
          COALESCE(parsed_severity, 'UNCLASSIFIED') AS severity,
          COUNT(*) AS cnt
        FROM {fq('logs_flattened')}
        WHERE {where}
        GROUP BY bucket, severity
        ORDER BY bucket
    """
    try:
        result = await execute_statement(sql, parameters=to_params(params), row_limit=50_000)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    # Re-shape into [{bucket, INFO, WARN, ERROR, FATAL, UNCLASSIFIED, TRACE_CONTINUATION}]
    severities = ("INFO", "WARN", "ERROR", "FATAL", "UNCLASSIFIED", "TRACE_CONTINUATION")
    buckets: dict[str, dict] = {}
    for r in result["rows"]:
        b = r.get("bucket")
        sev = (r.get("severity") or "UNCLASSIFIED").upper()
        cnt = int(r.get("cnt") or 0)
        if b not in buckets:
            buckets[b] = {"bucket": b, **{s: 0 for s in severities}}
        if sev not in severities:
            sev = "UNCLASSIFIED"
        buckets[b][sev] = buckets[b].get(sev, 0) + cnt

    series = sorted(buckets.values(), key=lambda x: x["bucket"] or "")
    return {
        "bucket_seconds": bucket_sec,
        "from": from_dt.isoformat(),
        "to": to_dt.isoformat(),
        "series": series,
    }


@router.get("/recent-errors")
async def recent_errors(
    limit: int = Query(50, ge=1, le=500),
    namespace: Optional[str] = Query(None),
):
    where_clauses = []
    params: dict = {}
    if namespace:
        where_clauses.append("namespace = :ns")
        params["ns"] = namespace

    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
    sql = f"""
        SELECT
          log_timestamp,
          parsed_severity,
          namespace,
          pod,
          deployment,
          container,
          service,
          node,
          body,
          body_length,
          trace_id,
          span_id,
          container_restart_count,
          log_iostream
        FROM {fq('logs_errors')}
        {where_sql}
        ORDER BY log_timestamp DESC
        LIMIT {int(limit)}
    """
    try:
        result = await execute_statement(sql, parameters=to_params(params))
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"rows": result["rows"], "columns": result["columns"]}


@router.get("/noisy-pods")
async def noisy_pods(
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=200),
    namespace: Optional[str] = Query(None),
):
    from_dt, to_dt = _resolve_window(from_, to)
    where = "log_timestamp >= :from_ts AND log_timestamp < :to_ts"
    params: dict = {
        "from_ts": from_dt.isoformat(),
        "to_ts": to_dt.isoformat(),
    }
    if namespace:
        where += " AND namespace = :ns"
        params["ns"] = namespace

    sql = f"""
        SELECT
          namespace,
          pod,
          COALESCE(service, '') AS service,
          COUNT(*) AS total,
          SUM(CASE WHEN parsed_severity IN ('ERROR','FATAL') THEN 1 ELSE 0 END) AS error_count,
          SUM(CASE WHEN parsed_severity = 'WARN' THEN 1 ELSE 0 END) AS warn_count
        FROM {fq('logs_flattened')}
        WHERE {where} AND pod IS NOT NULL
        GROUP BY namespace, pod, service
        ORDER BY total DESC
        LIMIT {int(limit)}
    """
    try:
        result = await execute_statement(sql, parameters=to_params(params))
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    rows = []
    for r in result["rows"]:
        rows.append(
            {
                "namespace": r.get("namespace"),
                "pod": r.get("pod"),
                "service": r.get("service") or None,
                "total": int(r.get("total") or 0),
                "error_count": int(r.get("error_count") or 0),
                "warn_count": int(r.get("warn_count") or 0),
            }
        )
    return {"rows": rows}
