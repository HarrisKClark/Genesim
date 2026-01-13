from __future__ import annotations

from typing import List, Optional, Literal

from pydantic import BaseModel, Field


class InducerConfig(BaseModel):
  """Configuration for a time-varying inducer concentration."""
  name: str  # e.g., "IPTG", "Arabinose", "aTc"
  function: Literal["constant", "sin", "pulse", "ramp", "square"] = "constant"
  # For constant: just use 'value'
  value: float = Field(default=1.0, ge=0.0)  # Constant concentration value
  # For sin/square/pulse: baseline + amplitude + period
  baseline: float = Field(default=0.0, ge=0.0)  # Baseline concentration
  amplitude: float = Field(default=1.0, ge=0.0)  # Amplitude of oscillation
  period: float = Field(default=100.0, gt=0.0)  # Period for periodic functions
  duty_cycle: float = Field(default=0.5, ge=0.0, le=1.0)  # For square/pulse waves
  # For ramp: baseline + slope
  slope: float = Field(default=0.01)  # Rate of change per time unit
  # Delay before function starts (returns baseline until delay passes)
  delay: float = Field(default=0.0, ge=0.0)  # Time delay before function activates


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
  
  # Inducible promoter: external small molecule (IPTG, aTc, Arabinose, etc.)
  inducerName: Optional[str] = None
  indK: float = Field(default=0.5, gt=0.0)  # Hill constant for inducer
  indN: float = Field(default=2.0, gt=0.0)  # Hill coefficient for inducer
  
  terminatorName: Optional[str] = None
  cistrons: List[CistronIn]


class SimulationParams(BaseModel):
  # time (with reasonable upper bounds to prevent DoS)
  T: float = Field(default=1000.0, gt=0.0, le=1_000_000.0)  # Max 1 million time units
  dt: float = Field(default=1.0, gt=0.001)  # Min step size to prevent excessive steps

  # solver
  method: str = Field(default="deterministic")  # "deterministic" | "stochastic" | "flow"
  seed: Optional[int] = Field(default=None, ge=0, le=2**31 - 1)  # Bounded seed
  runs: int = Field(default=200, ge=1, le=10_000)  # Reduced max for safety

  # kinetics
  alpha_m_base: float = Field(default=1.0, ge=0.0)
  alpha_p_base: float = Field(default=1.0, ge=0.0)
  delta_m: float = Field(default=0.1, ge=0.0)
  delta_p: float = Field(default=0.01, ge=0.0)

  # initial conditions
  # Backwards-compatible scalar initial conditions (broadcasted).
  m0: float = Field(default=0.0, ge=0.0)
  p0: float = Field(default=0.0, ge=0.0)

  # Preferred: per-gene initial conditions, flattened in request order:
  # transcripts[0].cistrons[0..] then transcripts[1].cistrons[0..], ...
  m0_by_gene: Optional[List[float]] = Field(default=None)
  p0_by_gene: Optional[List[float]] = Field(default=None)

  # Inducer configurations for inducible promoters
  inducers: Optional[List[InducerConfig]] = Field(default=None)


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
  # Optional per-gene mRNA time series (same order as cistrons). If present, mRNA is the sum.
  mRNAs: Optional[List[TimeSeries]] = None
  proteins: List[TimeSeries]


class SummaryRow(BaseModel):
  transcriptId: str
  promoterName: str
  cistronCount: int
  final_mRNA: float
  final_proteins: List[float]


class InducerTimeSeries(BaseModel):
  name: str
  values: List[float]


class SimulateTranscriptsResponse(BaseModel):
  time: List[float]
  transcripts: List[TranscriptResult]
  summary: List[SummaryRow]
  flowCytometry: Optional[dict] = None
  inducers: Optional[List[InducerTimeSeries]] = None


