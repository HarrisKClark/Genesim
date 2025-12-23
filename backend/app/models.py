from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class CistronIn(BaseModel):
  id: str
  geneName: str
  rbsName: Optional[str] = None
  rbsStrength: float = Field(ge=0.0)


class TranscriptIn(BaseModel):
  id: str
  promoterName: str
  promoterStrength: float = Field(ge=0.0)
  leak: float = Field(default=0.0, ge=0.0, le=1.0)

  # Hill activation params (optional; if activatorName missing, activation factor = 1)
  activatorName: Optional[str] = None
  actK: float = Field(default=10.0, gt=0.0)
  actN: float = Field(default=2.0, gt=0.0)

  # Hill repression params (optional; if inhibitorName missing, repression factor = 1)
  inhibitorName: Optional[str] = None
  repK: float = Field(default=10.0, gt=0.0)
  repN: float = Field(default=2.0, gt=0.0)
  terminatorName: Optional[str] = None
  cistrons: List[CistronIn]


class SimulationParams(BaseModel):
  # time
  T: float = Field(default=1000.0, gt=0.0)
  dt: float = Field(default=1.0, gt=0.0)

  # solver
  method: str = Field(default="deterministic")  # "deterministic" | "stochastic" | "flow"
  seed: Optional[int] = None
  runs: int = Field(default=200, ge=1, le=100000)

  # kinetics
  alpha_m_base: float = Field(default=1.0, ge=0.0)
  alpha_p_base: float = Field(default=1.0, ge=0.0)
  delta_m: float = Field(default=0.1, ge=0.0)
  delta_p: float = Field(default=0.01, ge=0.0)

  # initial conditions
  m0: float = Field(default=0.0, ge=0.0)
  p0: float = Field(default=0.0, ge=0.0)


class SimulateTranscriptsRequest(BaseModel):
  transcripts: List[TranscriptIn]
  params: SimulationParams = Field(default_factory=SimulationParams)


class TimeSeries(BaseModel):
  id: str
  label: str
  values: List[float]


class TranscriptResult(BaseModel):
  id: str
  promoterName: str
  terminatorName: Optional[str] = None
  mRNA: TimeSeries
  proteins: List[TimeSeries]


class SummaryRow(BaseModel):
  transcriptId: str
  promoterName: str
  cistronCount: int
  final_mRNA: float
  final_proteins: List[float]


class SimulateTranscriptsResponse(BaseModel):
  time: List[float]
  transcripts: List[TranscriptResult]
  summary: List[SummaryRow]
  flowCytometry: Optional[dict] = None


