"""FastAPI entry point for the OTel Observability Databricks App."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from server.config import (
    get_genie_space_id,
    get_otel_catalog,
    get_otel_schema,
)
from server.routes import binpacking as binpacking_routes
from server.routes import dashboard as dashboard_routes
from server.routes import genie as genie_routes

app = FastAPI(
    title="OTel Observability",
    description="Dashboard + Genie chat over Zerobus-fed OpenTelemetry tables.",
    version="0.1.0",
)

app.include_router(dashboard_routes.router)
app.include_router(binpacking_routes.router)
app.include_router(genie_routes.router)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "catalog": get_otel_catalog(),
        "schema": get_otel_schema(),
        "warehouse_configured": bool(os.environ.get("DATABRICKS_WAREHOUSE_ID")),
        "genie_configured": bool(get_genie_space_id()),
    }


# --- Serve the built React frontend -----------------------------------------

FRONTEND_DIST = Path(__file__).parent / "frontend" / "dist"


if FRONTEND_DIST.exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/")
    async def serve_index():
        return FileResponse(FRONTEND_DIST / "index.html")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # API paths handled by routers above; this is the SPA fallback.
        if full_path.startswith("api/"):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        target = FRONTEND_DIST / full_path
        if target.is_file():
            return FileResponse(target)
        return FileResponse(FRONTEND_DIST / "index.html")

else:

    @app.get("/")
    async def index_dev_hint():
        return JSONResponse(
            {
                "status": "ok",
                "note": (
                    "Frontend not built. Run `cd frontend && npm run build`, "
                    "or hit http://localhost:5173 in dev mode."
                ),
            }
        )
