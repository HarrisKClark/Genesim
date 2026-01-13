"""
Simulation module: Main entry points for running simulations.
"""
from __future__ import annotations

import json
from typing import Callable, Iterator, List, Tuple

try:
    from joblib import Parallel, delayed
except Exception:  # pragma: no cover
    Parallel = None  # type: ignore
    def delayed(fn):  # type: ignore
        return fn

import numpy as np
from queue import Empty, Queue
from threading import Thread

from .integrators import (
    TranscriptSpec,
    rk4_integrate,
    gillespie_integrate,
    gillespie_final_state,
)
from .kinetics import canonical_inhibitor_key
from .response_builder import (
    build_time_series_response,
    initial_by_gene_from_params,
)
from .models import (
    SimulationParams,
    SimulateTranscriptsResponse,
)


def _run_flow_simulation(
    transcripts,
    specs: List[TranscriptSpec],
    params: SimulationParams,
    progress_callback: Callable[[float], None] | None = None,
) -> SimulateTranscriptsResponse:
    """Run flow cytometry simulation (multiple Gillespie runs, final states only)."""
    runs = int(params.runs)
    base_seed = params.seed

    m0_by_gene, p0_by_gene = initial_by_gene_from_params(specs, params)

    protein_label_to_indices: dict[str, list[int]] = {}
    display_name_by_key: dict[str, str] = {}
    base = 0

    for spec in specs:
        n = len(spec.cistron_ids)
        for j in range(n):
            key = canonical_inhibitor_key(spec.protein_labels[j])
            protein_label_to_indices.setdefault(key, []).append(base + 2 * j + 1)
            display_name_by_key.setdefault(key, spec.protein_labels[j])
        base += 2 * n

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
            m0_by_gene=m0_by_gene,
            p0_by_gene=p0_by_gene,
            seed=seed,
        )

    if progress_callback:
        progress_interval = max(1, runs // 100)
        for i in range(runs):
            seed = (int(base_seed) + i) if base_seed is not None else None
            y_end = _run_single(seed)
            _accumulate_state(y_end)
            if (i + 1) % progress_interval == 0 or i == runs - 1:
                progress_callback(float(i + 1) / float(runs))
        progress_callback(1.0)
    else:
        if Parallel is None:
            for i in range(runs):
                seed = (int(base_seed) + i) if base_seed is not None else None
                _accumulate_state(_run_single(seed))
        else:
            all_final_states = Parallel(n_jobs=-1)(
                delayed(_run_single)((int(base_seed) + i) if base_seed is not None else None)
                for i in range(runs)
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


def _run_time_series(
    specs: List[TranscriptSpec],
    params: SimulationParams,
    method: str,
    progress_callback: Callable[[float], None] | None = None,
) -> Tuple[np.ndarray, np.ndarray]:
    """Run time series simulation using specified method."""
    m0_by_gene, p0_by_gene = initial_by_gene_from_params(specs, params)

    if method == "stochastic":
        return gillespie_integrate(
            specs=specs,
            T=float(params.T),
            dt=float(params.dt),
            alpha_m_base=float(params.alpha_m_base),
            alpha_p_base=float(params.alpha_p_base),
            delta_m=float(params.delta_m),
            delta_p=float(params.delta_p),
            m0_by_gene=m0_by_gene,
            p0_by_gene=p0_by_gene,
            seed=params.seed,
            progress_callback=progress_callback,
            inducer_configs=params.inducers,
        )

    return rk4_integrate(
        specs=specs,
        T=float(params.T),
        dt=float(params.dt),
        alpha_m_base=float(params.alpha_m_base),
        alpha_p_base=float(params.alpha_p_base),
        delta_m=float(params.delta_m),
        delta_p=float(params.delta_p),
        m0_by_gene=m0_by_gene,
        p0_by_gene=p0_by_gene,
        progress_callback=progress_callback,
        inducer_configs=params.inducers,
    )


def _simulate_events(
    transcripts,
    specs: List[TranscriptSpec],
    params: SimulationParams,
    method: str,
) -> Iterator[dict]:
    """Run simulation with progress events for streaming."""
    queue: Queue = Queue()
    last_milestone = [-1]

    def progress_event(value: float):
        milestone = int(value * 100) // 5 * 5
        if milestone > last_milestone[0]:
            last_milestone[0] = milestone
            queue.put({"type": "progress", "value": milestone / 100.0})

    def run():
        try:
            if method == "flow":
                result = _run_flow_simulation(transcripts, specs, params, progress_event)
            else:
                t, Y = _run_time_series(specs, params, method, progress_event)
                result = build_time_series_response(transcripts, specs, t, Y, params)
            queue.put({"type": "result", "data": result})
        except Exception as e:
            queue.put({"type": "error", "message": str(e)})

    thread = Thread(target=run, daemon=True)
    thread.start()

    while True:
        try:
            event = queue.get(timeout=0.1)
        except Empty:
            if not thread.is_alive():
                break
            continue

        yield event

        if event.get("type") in ("result", "error"):
            break

    thread.join()


def build_specs_from_transcripts(transcripts) -> List[TranscriptSpec]:
    """Build TranscriptSpec list from transcript input data."""
    specs: List[TranscriptSpec] = []
    for tx in transcripts:
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
                inducer_name=tx.inducerName,
                indK=float(tx.indK),
                indN=float(tx.indN),
                cistron_ids=[c.id for c in tx.cistrons],
                protein_labels=[c.geneName for c in tx.cistrons],
                rbs_strengths=np.array([float(c.rbsStrength) for c in tx.cistrons], dtype=float),
            )
        )
    return specs


def simulate_transcripts_stream(
    transcripts,
    params: SimulationParams,
    method: str = "deterministic",
) -> Iterator[str]:
    """
    Stream simulation progress and results as Server-Sent Events.
    """
    specs = build_specs_from_transcripts(transcripts)
    
    for event in _simulate_events(transcripts, specs, params, method):
        event_type = event.get("type", "")
        
        if event_type == "progress":
            yield f"data: {json.dumps({'type': 'progress', 'value': event['value']})}\n\n"
        elif event_type == "result":
            result = event["data"]
            yield f"data: {json.dumps({'type': 'result', 'data': result.model_dump()})}\n\n"
        elif event_type == "error":
            yield f"data: {json.dumps({'type': 'error', 'message': event['message']})}\n\n"


def simulate_transcripts(
    transcripts,
    params: SimulationParams,
    method: str = "deterministic",
) -> SimulateTranscriptsResponse:
    """
    Non-streaming simulation entry point.
    """
    specs = build_specs_from_transcripts(transcripts)
    
    if method == "flow":
        return _run_flow_simulation(transcripts, specs, params)
    
    t, Y = _run_time_series(specs, params, method)
    return build_time_series_response(transcripts, specs, t, Y, params)
