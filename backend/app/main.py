from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .models import SimulateTranscriptsRequest, SimulateTranscriptsResponse

import json
import numpy as np

from .simulate import (
    TranscriptSpec,
    _build_time_series_response,
    _run_flow_simulation,
    _run_time_series,
    _simulate_events,
)


app = FastAPI(title="GeneSim Backend", version="0.1.0")

# Dev-friendly CORS; tighten later for production deployments
app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)


def _build_specs_from_transcripts(transcripts: list[any]) -> list[TranscriptSpec]:
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
  params = req.params

  specs = _build_specs_from_transcripts(req.transcripts)

  method = (params.method or "deterministic").lower()
  if method == "flow":
    return _run_flow_simulation(req.transcripts, specs, params)

  t, Y = _run_time_series(specs, params, method)
  return _build_time_series_response(req.transcripts, specs, t, Y)


@app.post("/api/simulate/transcripts/stream")
def simulate_transcripts_stream(req: SimulateTranscriptsRequest):
  params = req.params
  specs = _build_specs_from_transcripts(req.transcripts)
  method = (params.method or "deterministic").lower()

  def event_stream():
    for event in _simulate_events(req.transcripts, specs, params, method):
      yield json.dumps(event) + "\n"

  return StreamingResponse(event_stream(), media_type="application/json")


