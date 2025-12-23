from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Iterator, List, Tuple

import json
from joblib import Parallel, delayed
from numba import njit
import numpy as np
from queue import Empty, Queue
from threading import Thread
from .models import SimulationParams, SimulateTranscriptsResponse, SummaryRow, TimeSeries, TranscriptResult


@dataclass(frozen=True)
class TranscriptSpec:
  transcript_id: str
  promoter_strength: float
  leak: float
  activator_name: str | None
  actK: float
  actN: float
  inhibitor_name: str | None
  repK: float
  repN: float
  cistron_ids: List[str]
  protein_labels: List[str]
  rbs_strengths: np.ndarray  # shape (n_cistrons,)

def _norm_label(s: str) -> str:
  # Normalize for robust matching (e.g. "LacI" vs "Lac I" vs "lac i")
  # Keep only alphanumerics, lowercase.
  return "".join(ch.lower() for ch in s if ch.isalnum())

def _canonical_inhibitor_key(s: str) -> str:
  """
  Map common synonym spellings to a canonical inhibitor key so promoter<->protein matching
  works across the whole app, even if older circuits use different names.
  """
  n = _norm_label(s)
  aliases = {
    # LacI
    "laci": "laci",
    "lacrepressor": "laci",
    # TetR
    "tetr": "tetr",
    "tetrepressor": "tetr",
    # Lambda CI / cI
    "ci": "ci",
    "lambdaci": "ci",
    "lambdacirepressor": "ci",
    "lambdac1": "ci",  # common typo/variant
  }
  return aliases.get(n, n)


@njit
def _hill_activation(activator: float, K: float, n: float, leak: float) -> float:
  """JIT-compiled Hill activation function."""
  if K <= 0.0:
    return leak
  An = activator ** n
  Kn = K ** n
  hill = An / (Kn + An)
  return leak + (1.0 - leak) * hill


@njit
def _hill_repression(inhibitor: float, K: float, n: float) -> float:
  """JIT-compiled Hill repression function."""
  if K <= 0.0:
    return 1.0
  ratio = inhibitor / K
  return 1.0 / (1.0 + ratio ** n)


@njit
def _rhs_numba(
  y: np.ndarray,
  promoter_strengths: np.ndarray,
  rbs_strengths_flat: np.ndarray,
  rbs_offsets: np.ndarray,
  leak_vals: np.ndarray,
  activator_indices: np.ndarray,
  activator_K: np.ndarray,
  activator_n: np.ndarray,
  inhibitor_indices: np.ndarray,
  inhibitor_K: np.ndarray,
  inhibitor_n: np.ndarray,
  spec_offsets: np.ndarray,
  n_cistrons: np.ndarray,
  alpha_m_base: float,
  alpha_p_base: float,
  delta_m: float,
  delta_p: float,
) -> np.ndarray:
  """
  JIT-compiled RHS function for ODE integration.
  All data is pre-packed into NumPy arrays for speed.
  """
  dy = np.zeros_like(y)
  n_specs = len(spec_offsets)
  
  for spec_idx in range(n_specs):
    offset = spec_offsets[spec_idx]
    n = n_cistrons[spec_idx]
    m = y[offset]
    p = y[offset + 1 : offset + 1 + n]
    
    alpha_m = alpha_m_base * promoter_strengths[spec_idx]
    
    # Activation factor
    act_idx = activator_indices[spec_idx]
    if act_idx >= 0:
      activator = np.sum(y[y == y])  # dummy to allow indexing - will be replaced
      activator = 0.0
      # Sum all proteins matching this activator
      for i in range(len(y)):
        if i >= offset + 1 and i < offset + 1 + n:
          # This is a protein in current spec, check if it matches activator
          pass
      f_act = _hill_activation(activator, activator_K[spec_idx], activator_n[spec_idx], leak_vals[spec_idx])
    else:
      f_act = 1.0
    
    # Repression factor  
    inh_idx = inhibitor_indices[spec_idx]
    if inh_idx >= 0:
      inhibitor = 0.0
      # This would need protein index lookup - keep simple for now
      f_rep = 1.0
    else:
      f_rep = 1.0
    
    alpha_m = alpha_m * f_act * f_rep
    dy[offset] = alpha_m - delta_m * m
    
    # Translation
    rbs_start = rbs_offsets[spec_idx]
    for j in range(n):
      alpha_p = alpha_p_base * rbs_strengths_flat[rbs_start + j]
      dy[offset + 1 + j] = alpha_p * m - delta_p * p[j]
  
  return dy


def _rhs_transcripts(
  y: np.ndarray,
  specs: List[TranscriptSpec],
  protein_index_by_label: dict[str, np.ndarray],
  alpha_m_base: float,
  alpha_p_base: float,
  delta_m: float,
  delta_p: float,
) -> np.ndarray:
  """
  y is concatenated transcript states:
    [m, p1, p2, ..., pN] per transcript, concatenated across transcripts.
  Returns dy/dt with same shape.
  """
  dy = np.zeros_like(y)
  offset = 0
  for spec in specs:
    n = len(spec.cistron_ids)
    m = y[offset]
    p = y[offset + 1 : offset + 1 + n]

    alpha_m = alpha_m_base * spec.promoter_strength
    # Activation factor
    if spec.activator_name:
      idxs = protein_index_by_label.get(_canonical_inhibitor_key(spec.activator_name))
      activator = float(np.sum(y[idxs])) if idxs is not None else 0.0
      f_act = _hill_activation(activator, spec.actK, spec.actN, spec.leak)
    else:
      f_act = 1.0

    # Repression factor
    if spec.inhibitor_name:
      idxs = protein_index_by_label.get(_canonical_inhibitor_key(spec.inhibitor_name))
      inhibitor = float(np.sum(y[idxs])) if idxs is not None else 0.0
      f_rep = _hill_repression(inhibitor, spec.repK, spec.repN)
    else:
      f_rep = 1.0

    alpha_m = alpha_m * f_act * f_rep
    dy[offset] = alpha_m - delta_m * m

    # Coupled translation: protein rate proportional to mRNA level
    alpha_p_vec = alpha_p_base * spec.rbs_strengths
    dy[offset + 1 : offset + 1 + n] = alpha_p_vec * m - delta_p * p

    offset += 1 + n
  return dy


def rk4_integrate(
  specs: List[TranscriptSpec],
  T: float,
  dt: float,
  alpha_m_base: float,
  alpha_p_base: float,
  delta_m: float,
  delta_p: float,
  m0: float,
  p0: float,
  progress_callback: Callable[[float], None] | None = None,
) -> Tuple[np.ndarray, np.ndarray]:
  """
  Returns (t, Y) where:
    t shape (steps,)
    Y shape (steps, total_state_dim)
  """
  steps = int(np.floor(T / dt)) + 1
  t = np.linspace(0.0, dt * (steps - 1), steps)

  total_dim = sum(1 + len(s.cistron_ids) for s in specs)
  y = np.zeros((total_dim,), dtype=float)

  # initial conditions per transcript
  off = 0
  for s in specs:
    n = len(s.cistron_ids)
    y[off] = m0
    y[off + 1 : off + 1 + n] = p0
    off += 1 + n

  Y = np.zeros((steps, total_dim), dtype=float)
  Y[0] = y

  # Precompute indices for summing inhibitor concentrations
  # Protein state indices depend on transcript packing: [m, p1..pN] repeated.
  protein_label_to_indices: dict[str, list[int]] = {}
  base = 0
  for spec in specs:
    n = len(spec.cistron_ids)
    for j in range(n):
      lbl = _canonical_inhibitor_key(spec.protein_labels[j])
      protein_label_to_indices.setdefault(lbl, []).append(base + 1 + j)
    base += 1 + n
  protein_index_by_label: dict[str, np.ndarray] = {k: np.array(v, dtype=int) for k, v in protein_label_to_indices.items()}

  # Use vectorized RK4 step for better performance
  total_progress_steps = max(1, steps - 1)
  progress_interval = max(1, total_progress_steps // 50)
  for k in range(1, steps):
    k1 = _rhs_transcripts(y, specs, protein_index_by_label, alpha_m_base, alpha_p_base, delta_m, delta_p)
    y_temp = y + 0.5 * dt * k1
    k2 = _rhs_transcripts(y_temp, specs, protein_index_by_label, alpha_m_base, alpha_p_base, delta_m, delta_p)
    y_temp = y + 0.5 * dt * k2
    k3 = _rhs_transcripts(y_temp, specs, protein_index_by_label, alpha_m_base, alpha_p_base, delta_m, delta_p)
    y_temp = y + dt * k3
    k4 = _rhs_transcripts(y_temp, specs, protein_index_by_label, alpha_m_base, alpha_p_base, delta_m, delta_p)
    y = y + (dt / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4)

    # clamp to non-negative to avoid tiny negative numerical drift
    y = np.maximum(y, 0.0)
    Y[k] = y

    if progress_callback and (k == steps - 1 or k % progress_interval == 0):
      progress_callback(float(k) / float(total_progress_steps))

  return t, Y


def gillespie_integrate(
  specs: List[TranscriptSpec],
  T: float,
  dt: float,
  alpha_m_base: float,
  alpha_p_base: float,
  delta_m: float,
  delta_p: float,
  m0: float,
  p0: float,
  seed: int | None = None,
  progress_callback: Callable[[float], None] | None = None,
) -> Tuple[np.ndarray, np.ndarray]:
  """
  Gillespie SSA for standard birth/death gene expression:
    ∅ -> m         rate a_tx
    m -> ∅         rate delta_m * m
    m -> m + p_i   rate alpha_p_base * rbsStrength_i * m
    p_i -> ∅       rate delta_p * p_i

  Hill repression affects transcription propensity a_tx.
  Output is sampled on the uniform dt grid by holding last state.
  """
  steps = int(np.floor(T / dt)) + 1
  tgrid = np.linspace(0.0, dt * (steps - 1), steps)

  total_dim = sum(1 + len(s.cistron_ids) for s in specs)
  y = np.zeros((total_dim,), dtype=float)

  # initial conditions per transcript
  off = 0
  for s in specs:
    n = len(s.cistron_ids)
    y[off] = float(m0)
    y[off + 1 : off + 1 + n] = float(p0)
    off += 1 + n

  # indices for inhibitor coupling (canonicalized)
  protein_label_to_indices: dict[str, list[int]] = {}
  base = 0
  for spec in specs:
    n = len(spec.cistron_ids)
    for j in range(n):
      lbl = _canonical_inhibitor_key(spec.protein_labels[j])
      protein_label_to_indices.setdefault(lbl, []).append(base + 1 + j)
    base += 1 + n
  protein_index_by_label: dict[str, np.ndarray] = {k: np.array(v, dtype=int) for k, v in protein_label_to_indices.items()}

  rng = np.random.default_rng(seed)

  Y = np.zeros((steps, total_dim), dtype=float)
  # record t=0
  Y[0] = y
  next_sample = 1
  t = 0.0

  # Precompute per transcript slices for speed
  slices: list[tuple[int, int]] = []
  o = 0
  for s in specs:
    n = len(s.cistron_ids)
    slices.append((o, n))
    o += 1 + n
  
  # Pre-allocate propensities array for reuse
  max_reactions = sum(2 + 2 * len(s.cistron_ids) for s in specs)
  props = np.zeros(max_reactions, dtype=np.float64)

  progress_steps = max(1, steps - 1)
  progress_threshold = max(1, progress_steps // 50)
  next_progress_target = progress_threshold
  while t < T and next_sample < steps:
    # build propensities and reaction bookkeeping
    reactions: list[tuple[str, int, int]] = []  # (kind, tx_idx, prot_idx) prot_idx used for tl/degp
    prop_idx = 0

    for txi, spec in enumerate(specs):
      o, n = slices[txi]
      m = y[o]
      p = y[o + 1 : o + 1 + n]

      # transcription with Hill repression
      a_tx = alpha_m_base * spec.promoter_strength

      if spec.activator_name:
        idxs = protein_index_by_label.get(_canonical_inhibitor_key(spec.activator_name))
        activator = float(np.sum(y[idxs])) if idxs is not None else 0.0
        f_act = _hill_activation(activator, spec.actK, spec.actN, spec.leak)
      else:
        f_act = 1.0

      if spec.inhibitor_name:
        idxs = protein_index_by_label.get(_canonical_inhibitor_key(spec.inhibitor_name))
        inhibitor = float(np.sum(y[idxs])) if idxs is not None else 0.0
        f_rep = _hill_repression(inhibitor, spec.repK, spec.repN)
      else:
        f_rep = 1.0

      a_tx *= f_act * f_rep

      props[prop_idx] = max(0.0, a_tx)
      reactions.append(("tx", txi, -1))
      prop_idx += 1

      # mRNA decay
      props[prop_idx] = max(0.0, delta_m * m)
      reactions.append(("degm", txi, -1))
      prop_idx += 1

      # translation per cistron
      for j in range(n):
        props[prop_idx] = max(0.0, alpha_p_base * spec.rbs_strengths[j] * m)
        reactions.append(("tl", txi, j))
        prop_idx += 1

      # protein decay per cistron
      for j in range(n):
        props[prop_idx] = max(0.0, delta_p * p[j])
        reactions.append(("degp", txi, j))
        prop_idx += 1

    # Use only valid propensities
    props_valid = props[:prop_idx]
    a0 = float(np.sum(props_valid))
    if a0 <= 0.0:
      # no reactions possible; hold state
      while next_sample < steps:
        Y[next_sample] = y
        next_sample += 1
      if progress_callback:
        progress_callback(1.0)
      break

    r1 = float(rng.random())
    r2 = float(rng.random())
    tau = (1.0 / a0) * np.log(1.0 / max(r1, 1e-12))
    t_next = t + tau

    # sample any grid points we crossed, holding previous state
    while next_sample < steps and tgrid[next_sample] <= t_next:
      Y[next_sample] = y
      next_sample += 1

      if progress_callback:
        while next_sample >= next_progress_target and next_progress_target <= progress_steps:
          progress_callback(float(next_progress_target) / float(progress_steps))
          next_progress_target += progress_threshold

    # choose reaction using cumsum for efficiency
    target = r2 * a0
    cumsum = np.cumsum(props_valid)
    mu = np.searchsorted(cumsum, target)
    if mu >= len(reactions):
      mu = len(reactions) - 1

    kind, txi, j = reactions[mu]
    o, n = slices[txi]

    if kind == "tx":
      y[o] += 1.0
    elif kind == "degm":
      if y[o] > 0:
        y[o] -= 1.0
    elif kind == "tl":
      # m -> m + p
      y[o + 1 + j] += 1.0
    elif kind == "degp":
      idx = o + 1 + j
      if y[idx] > 0:
        y[idx] -= 1.0

    t = t_next

  # fill remaining samples at end
  while next_sample < steps:
    Y[next_sample] = y
    next_sample += 1

  if progress_callback:
    progress_callback(1.0)

  return tgrid, Y


def gillespie_final_state(
  specs: List[TranscriptSpec],
  T: float,
  alpha_m_base: float,
  alpha_p_base: float,
  delta_m: float,
  delta_p: float,
  m0: float,
  p0: float,
  seed: int | None = None,
) -> np.ndarray:
  """
  Gillespie SSA, but only returns final state at time T (no sampling).
  Much faster for flow-cytometry mode.
  """
  total_dim = sum(1 + len(s.cistron_ids) for s in specs)
  y = np.zeros((total_dim,), dtype=float)

  off = 0
  for s in specs:
    n = len(s.cistron_ids)
    y[off] = float(m0)
    y[off + 1 : off + 1 + n] = float(p0)
    off += 1 + n

  protein_label_to_indices: dict[str, list[int]] = {}
  display_name_by_key: dict[str, str] = {}
  base = 0
  for spec in specs:
    n = len(spec.cistron_ids)
    for j in range(n):
      raw = spec.protein_labels[j]
      key = _canonical_inhibitor_key(raw)
      protein_label_to_indices.setdefault(key, []).append(base + 1 + j)
      display_name_by_key.setdefault(key, raw)
    base += 1 + n
  protein_index_by_label: dict[str, np.ndarray] = {k: np.array(v, dtype=int) for k, v in protein_label_to_indices.items()}

  rng = np.random.default_rng(seed)

  slices: list[tuple[int, int]] = []
  o = 0
  for s in specs:
    n = len(s.cistron_ids)
    slices.append((o, n))
    o += 1 + n

  # Pre-allocate propensities array
  max_reactions = sum(2 + 2 * len(s.cistron_ids) for s in specs)
  props = np.zeros(max_reactions, dtype=np.float64)

  t = 0.0
  while t < T:
    reactions: list[tuple[str, int, int]] = []
    prop_idx = 0

    for txi, spec in enumerate(specs):
      o, n = slices[txi]
      m = y[o]
      p = y[o + 1 : o + 1 + n]

      a_tx = alpha_m_base * spec.promoter_strength
      if spec.activator_name:
        idxs = protein_index_by_label.get(_canonical_inhibitor_key(spec.activator_name))
        activator = float(np.sum(y[idxs])) if idxs is not None else 0.0
        f_act = _hill_activation(activator, spec.actK, spec.actN, spec.leak)
      else:
        f_act = 1.0

      if spec.inhibitor_name:
        idxs = protein_index_by_label.get(_canonical_inhibitor_key(spec.inhibitor_name))
        inhibitor = float(np.sum(y[idxs])) if idxs is not None else 0.0
        f_rep = _hill_repression(inhibitor, spec.repK, spec.repN)
      else:
        f_rep = 1.0

      a_tx *= f_act * f_rep

      props[prop_idx] = max(0.0, a_tx)
      reactions.append(("tx", txi, -1))
      prop_idx += 1

      props[prop_idx] = max(0.0, delta_m * m)
      reactions.append(("degm", txi, -1))
      prop_idx += 1

      for j in range(n):
        props[prop_idx] = max(0.0, alpha_p_base * spec.rbs_strengths[j] * m)
        reactions.append(("tl", txi, j))
        prop_idx += 1

      for j in range(n):
        props[prop_idx] = max(0.0, delta_p * p[j])
        reactions.append(("degp", txi, j))
        prop_idx += 1

    props_valid = props[:prop_idx]
    a0 = float(np.sum(props_valid))
    if a0 <= 0.0:
      break

    r1 = float(rng.random())
    r2 = float(rng.random())
    tau = (1.0 / a0) * np.log(1.0 / max(r1, 1e-12))
    t_next = t + tau
    if t_next > T:
      break

    target = r2 * a0
    cumsum = np.cumsum(props_valid)
    mu = np.searchsorted(cumsum, target)
    if mu >= len(reactions):
      mu = len(reactions) - 1

    kind, txi, j = reactions[mu]
    o, n = slices[txi]
    if kind == "tx":
      y[o] += 1.0
    elif kind == "degm":
      if y[o] > 0:
        y[o] -= 1.0
    elif kind == "tl":
      y[o + 1 + j] += 1.0
    elif kind == "degp":
      idx = o + 1 + j
      if y[idx] > 0:
        y[idx] -= 1.0

    t = t_next

  return y


def unpack_results(
  t: np.ndarray,
  Y: np.ndarray,
  specs: List[TranscriptSpec],
) -> List[dict]:
  """
  Convert packed Y into a structured list per transcript.
  """
  results: List[dict] = []
  off = 0
  for spec in specs:
    n = len(spec.cistron_ids)
    m = Y[:, off]
    p = Y[:, off + 1 : off + 1 + n]
    results.append(
      {
        "id": spec.transcript_id,
        "m": m,
        "p": p,
        "cistron_ids": spec.cistron_ids,
      }
    )
    off += 1 + n
  return results


def _run_flow_simulation(
  transcripts,
  specs: List[TranscriptSpec],
  params: SimulationParams,
  progress_callback: Callable[[float], None] | None = None,
) -> SimulateTranscriptsResponse:
  runs = int(params.runs)
  base_seed = params.seed

  protein_label_to_indices: dict[str, list[int]] = {}
  display_name_by_key: dict[str, str] = {}
  base = 0

  for spec in specs:
    n = len(spec.cistron_ids)
    for j in range(n):
      key = _canonical_inhibitor_key(spec.protein_labels[j])
      protein_label_to_indices.setdefault(key, []).append(base + 1 + j)
      display_name_by_key.setdefault(key, spec.protein_labels[j])
    base += 1 + n

  protein_index_by_label: dict[str, np.ndarray] = {
    k: np.array(v, dtype=int) for k, v in protein_label_to_indices.items()
  }

  values_by_key: dict[str, list[float]] = {k: [] for k in protein_index_by_label.keys()}

  def _accumulate_state(y_state: np.ndarray):
    for key, idxs in protein_index_by_label.items():
      values_by_key[key].append(float(np.sum(y_state[idxs])))

  def _run_single(seed: int | None):
    return gillespie_final_state(
      specs=specs,
      T=float(params.T),
      alpha_m_base=float(params.alpha_m_base),
      alpha_p_base=float(params.alpha_p_base),
      delta_m=float(params.delta_m),
      delta_p=float(params.delta_p),
      m0=float(params.m0),
      p0=float(params.p0),
      seed=seed,
    )

  if progress_callback:
    for i in range(runs):
      seed = (int(base_seed) + i) if base_seed is not None else None
      y_end = _run_single(seed)
      _accumulate_state(y_end)
      progress_callback(float(i + 1) / float(runs))
  else:
    all_final_states = Parallel(n_jobs=-1)(
      delayed(_run_single)((int(base_seed) + i) if base_seed is not None else None) for i in range(runs)
    )
    for y_end in all_final_states:
      _accumulate_state(y_end)

  proteins = [
    {"label": display_name_by_key[k], "values": v}
    for k, v in values_by_key.items()
    if len(v) > 0
  ]

  return SimulateTranscriptsResponse(
    time=[],
    transcripts=[],
    summary=[],
    flowCytometry={"runs": runs, "proteins": proteins},
  )


def _simulate_events(
  transcripts,
  specs: List[TranscriptSpec],
  params: SimulationParams,
  method: str,
) -> Iterator[dict]:
  queue: Queue = Queue()

  def progress_event(value: float):
    queue.put({"type": "progress", "value": float(min(1.0, max(0.0, value)))})

  def worker():
    try:
      if method == "flow":
        response = _run_flow_simulation(transcripts, specs, params, progress_callback=progress_event)
      else:
        t, Y = _run_time_series(specs, params, method, progress_callback=progress_event)
        response = _build_time_series_response(transcripts, specs, t, Y)

      queue.put({"type": "result", "value": response.model_dump()})
    except Exception as exc:
      queue.put({"type": "error", "value": str(exc)})

  thread = Thread(target=worker, daemon=True)
  thread.start()

  while True:
    try:
      event = queue.get(timeout=0.1)
    except Empty:
      if not thread.is_alive():
        break
      continue

    yield event
    if event["type"] in {"result", "error"}:
      break

  thread.join()


def _build_time_series_response(
  transcripts,
  specs: List[TranscriptSpec],
  t: np.ndarray,
  Y: np.ndarray,
) -> SimulateTranscriptsResponse:
  packed = unpack_results(t, Y, specs)

  transcript_results: list[TranscriptResult] = []
  summary: list[SummaryRow] = []

  packed_by_id = {r["id"]: r for r in packed}

  for tx in transcripts:
    r = packed_by_id.get(tx.id)
    if r is None:
      continue

    m_series = r["m"].tolist()
    p_mat = r["p"]

    proteins: list[TimeSeries] = []
    final_proteins: list[float] = []

    for idx, c in enumerate(tx.cistrons):
      label = c.geneName
      vals = p_mat[:, idx].tolist()
      proteins.append(TimeSeries(id=c.id, label=label, values=vals))
      final_proteins.append(float(vals[-1]))

    transcript_results.append(
      TranscriptResult(
        id=tx.id,
        promoterName=tx.promoterName,
        terminatorName=tx.terminatorName,
        mRNA=TimeSeries(id=f"{tx.id}:mRNA", label=f"{tx.promoterName} mRNA", values=m_series),
        proteins=proteins,
      )
    )

    summary.append(
      SummaryRow(
        transcriptId=tx.id,
        promoterName=tx.promoterName,
        cistronCount=len(tx.cistrons),
        final_mRNA=float(m_series[-1]),
        final_proteins=final_proteins,
      )
    )

  return SimulateTranscriptsResponse(time=t.tolist(), transcripts=transcript_results, summary=summary)


def _run_time_series(
  specs: List[TranscriptSpec],
  params: SimulationParams,
  method: str,
  progress_callback: Callable[[float], None] | None = None,
) -> Tuple[np.ndarray, np.ndarray]:
  if method == "stochastic":
    return gillespie_integrate(
      specs=specs,
      T=float(params.T),
      dt=float(params.dt),
      alpha_m_base=float(params.alpha_m_base),
      alpha_p_base=float(params.alpha_p_base),
      delta_m=float(params.delta_m),
      delta_p=float(params.delta_p),
      m0=float(params.m0),
      p0=float(params.p0),
      seed=params.seed,
      progress_callback=progress_callback,
    )

  return rk4_integrate(
    specs=specs,
    T=float(params.T),
    dt=float(params.dt),
    alpha_m_base=float(params.alpha_m_base),
    alpha_p_base=float(params.alpha_p_base),
    delta_m=float(params.delta_m),
    delta_p=float(params.delta_p),
    m0=float(params.m0),
    p0=float(params.p0),
    progress_callback=progress_callback,
  )


