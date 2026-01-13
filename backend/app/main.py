from __future__ import annotations

import os
import json
from typing import List

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from starlette.middleware.base import BaseHTTPMiddleware

import numpy as np

from .models import SimulateTranscriptsRequest, SimulateTranscriptsResponse
from .integrators import TranscriptSpec
from .response_builder import build_time_series_response
from .simulate import (
    _run_flow_simulation,
    _run_time_series,
    _simulate_events,
)


# =============================================================================
# Security Configuration
# =============================================================================

# Request limits to prevent DoS attacks
MAX_SIMULATION_STEPS = 1_000_000  # Maximum number of time steps
MAX_TRANSCRIPTS = 100  # Maximum number of transcripts per request
MAX_CISTRONS_PER_TRANSCRIPT = 50  # Maximum cistrons per transcript
MAX_RUNS = 10_000  # Maximum flow cytometry runs

# NOTE: For production deployments, consider adding rate limiting.
# Options: slowapi, fastapi-limiter, or nginx/cloudflare rate limiting.


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""
    
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        # Enable browser XSS protection
        response.headers["X-XSS-Protection"] = "1; mode=block"
        # Control referrer information
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


app = FastAPI(
    title="GeneSim Backend",
    version="0.1.0",
    docs_url="/api/docs" if os.environ.get("ENABLE_DOCS", "true").lower() == "true" else None,
    redoc_url="/api/redoc" if os.environ.get("ENABLE_DOCS", "true").lower() == "true" else None,
)

# Add security headers
app.add_middleware(SecurityHeadersMiddleware)

# CORS configuration: Use CORS_ORIGINS env var for production
# Default: permissive for development. Set CORS_ORIGINS=https://yourdomain.com for production.
_cors_origins_env = os.environ.get("CORS_ORIGINS", "*")
_cors_origins: List[str] = (
    ["*"] if _cors_origins_env == "*" 
    else [origin.strip() for origin in _cors_origins_env.split(",")]
)

app.add_middleware(
  CORSMiddleware,
  allow_origins=_cors_origins,
  allow_credentials=True if _cors_origins != ["*"] else False,  # Only allow credentials with specific origins
  allow_methods=["GET", "POST"],  # Only needed methods
  allow_headers=["Content-Type"],  # Only needed headers
)


def _validate_request(req: SimulateTranscriptsRequest) -> None:
  """Validate request parameters to prevent DoS attacks."""
  # Check transcript count
  if len(req.transcripts) > MAX_TRANSCRIPTS:
    raise HTTPException(
      status_code=400,
      detail=f"Too many transcripts: {len(req.transcripts)} > {MAX_TRANSCRIPTS}"
    )
  
  # Check cistron count per transcript
  for tx in req.transcripts:
    if len(tx.cistrons) > MAX_CISTRONS_PER_TRANSCRIPT:
      raise HTTPException(
        status_code=400,
        detail=f"Too many cistrons in transcript {tx.id}: {len(tx.cistrons)} > {MAX_CISTRONS_PER_TRANSCRIPT}"
      )
  
  # Check simulation steps (T / dt)
  params = req.params
  if params.dt > 0:
    steps = int(params.T / params.dt) + 1
    if steps > MAX_SIMULATION_STEPS:
      raise HTTPException(
        status_code=400,
        detail=f"Simulation would require {steps} steps, max is {MAX_SIMULATION_STEPS}. Reduce T or increase dt."
      )
  
  # Check flow cytometry runs
  if params.runs > MAX_RUNS:
    raise HTTPException(
      status_code=400,
      detail=f"Too many runs: {params.runs} > {MAX_RUNS}"
    )


def _build_specs_from_transcripts(transcripts: list) -> list[TranscriptSpec]:
  specs: list[TranscriptSpec] = []
  for tx in transcripts:
    cistron_ids = [c.id for c in tx.cistrons]
    rbs_strengths = [float(c.rbsStrength) for c in tx.cistrons]
    protein_labels = [c.geneName for c in tx.cistrons]
    specs.append(
      TranscriptSpec(
        transcript_id=tx.id,
        promoter_strength=float(tx.promoterStrength),
        leak=float(tx.leak),
        activator_name=tx.activatorName,
        actK=float(tx.actK),
        actN=float(tx.actN),
        inhibitor_name=tx.inhibitorName,
        repK=float(tx.repK),
        repN=float(tx.repN),
        inducer_name=getattr(tx, 'inducerName', None),
        indK=float(getattr(tx, 'indK', 0.5)),
        indN=float(getattr(tx, 'indN', 2.0)),
        cistron_ids=cistron_ids,
        protein_labels=protein_labels,
        rbs_strengths=np.array(rbs_strengths, dtype=float),
      )
    )
  return specs


@app.get("/api/health")
def health():
  return {"ok": True}


@app.post("/api/simulate/transcripts", response_model=SimulateTranscriptsResponse)
def simulate_transcripts(req: SimulateTranscriptsRequest) -> SimulateTranscriptsResponse:
  # Validate request to prevent DoS
  _validate_request(req)
  
  params = req.params
  specs = _build_specs_from_transcripts(req.transcripts)

  method = (params.method or "deterministic").lower()
  if method == "flow":
    return _run_flow_simulation(req.transcripts, specs, params)

  t, Y = _run_time_series(specs, params, method)
  return build_time_series_response(req.transcripts, specs, t, Y, params)


@app.post("/api/simulate/transcripts/stream")
def simulate_transcripts_stream(req: SimulateTranscriptsRequest):
  # Validate request to prevent DoS
  _validate_request(req)
  
  params = req.params
  specs = _build_specs_from_transcripts(req.transcripts)
  method = (params.method or "deterministic").lower()

  def event_stream():
    for event in _simulate_events(req.transcripts, specs, params, method):
      # Convert Pydantic models to dicts for JSON serialization
      if event.get("type") == "result" and hasattr(event.get("data"), "model_dump"):
        event = {"type": "result", "data": event["data"].model_dump()}
      yield json.dumps(event) + "\n"

  return StreamingResponse(
    event_stream(), 
    media_type="text/event-stream",
    headers={
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",  # Disable nginx buffering
    }
  )


