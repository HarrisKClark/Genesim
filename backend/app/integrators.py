"""
Integrators module: RK4 and Gillespie SSA integration functions.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, List, Tuple

import numpy as np

from .kinetics import (
    hill_activation,
    hill_repression,
    canonical_inhibitor_key,
    compute_inducer_concentration,
)
from .models import InducerConfig


@dataclass(frozen=True)
class TranscriptSpec:
    """Specification for a single transcript (operon) in the simulation."""
    transcript_id: str
    promoter_strength: float
    leak: float
    activator_name: str | None
    actK: float
    actN: float
    inhibitor_name: str | None
    repK: float
    repN: float
    inducer_name: str | None  # External inducer molecule (IPTG, aTc, etc.)
    indK: float  # Hill constant for inducer
    indN: float  # Hill coefficient for inducer
    cistron_ids: List[str]
    protein_labels: List[str]
    rbs_strengths: np.ndarray  # shape (n_cistrons,)


def _rhs_transcripts(
    y: np.ndarray,
    specs: List[TranscriptSpec],
    protein_index_by_label: dict[str, np.ndarray],
    alpha_m_base: float,
    alpha_p_base: float,
    delta_m: float,
    delta_p: float,
    inducer_concentrations: dict[str, float] | None = None,
) -> np.ndarray:
    """
    Compute dy/dt for the transcript system.
    
    y is concatenated transcript states:
        [m1, p1, m2, p2, ..., mN, pN] per transcript, concatenated across transcripts.
    Returns dy/dt with same shape.
    
    inducer_concentrations: dict mapping inducer names to their current concentration
    """
    dy = np.zeros_like(y)
    offset = 0
    for spec in specs:
        n = len(spec.cistron_ids)
        m = y[offset : offset + 2 * n : 2]
        p = y[offset + 1 : offset + 2 * n : 2]

        alpha_m = alpha_m_base * spec.promoter_strength
        
        # Inducer factor (for inducible promoters like pTet-aTc, pLac-IPTG)
        # Uses Hill activation: when inducer is 0, promoter is OFF (only leak)
        # When inducer is high, promoter is fully ON
        if spec.inducer_name and inducer_concentrations:
            inducer_conc = inducer_concentrations.get(spec.inducer_name, 0.0)
            f_ind = hill_activation(inducer_conc, spec.indK, spec.indN, spec.leak)
            alpha_m = alpha_m * f_ind
        
        # Activation factor (protein-mediated activation)
        if spec.activator_name:
            idxs = protein_index_by_label.get(canonical_inhibitor_key(spec.activator_name))
            activator = float(np.sum(y[idxs])) if idxs is not None else 0.0
            f_act = hill_activation(activator, spec.actK, spec.actN, spec.leak)
        else:
            f_act = 1.0

        # Repression factor
        if spec.inhibitor_name:
            idxs = protein_index_by_label.get(canonical_inhibitor_key(spec.inhibitor_name))
            inhibitor = float(np.sum(y[idxs])) if idxs is not None else 0.0
            f_rep = hill_repression(inhibitor, spec.repK, spec.repN)
        else:
            f_rep = 1.0

        alpha_m = alpha_m * f_act * f_rep
        # Per-gene mRNA/protein dynamics (no shared transcript mRNA).
        alpha_p_vec = alpha_p_base * spec.rbs_strengths
        dy[offset : offset + 2 * n : 2] = alpha_m - delta_m * m
        dy[offset + 1 : offset + 2 * n : 2] = alpha_p_vec * m - delta_p * p

        offset += 2 * n
    return dy


def _build_protein_index(specs: List[TranscriptSpec]) -> dict[str, np.ndarray]:
    """Build protein label to indices mapping for inhibitor coupling."""
    protein_label_to_indices: dict[str, list[int]] = {}
    base = 0
    for spec in specs:
        n = len(spec.cistron_ids)
        for j in range(n):
            lbl = canonical_inhibitor_key(spec.protein_labels[j])
            protein_label_to_indices.setdefault(lbl, []).append(base + 2 * j + 1)
        base += 2 * n
    return {k: np.array(v, dtype=int) for k, v in protein_label_to_indices.items()}


def _init_state(
    specs: List[TranscriptSpec],
    m0_by_gene: np.ndarray,
    p0_by_gene: np.ndarray,
) -> np.ndarray:
    """Initialize state vector from per-gene initial conditions."""
    total_genes = sum(len(s.cistron_ids) for s in specs)
    if len(m0_by_gene) != total_genes or len(p0_by_gene) != total_genes:
        raise ValueError(
            f"Expected m0_by_gene/p0_by_gene length {total_genes}, "
            f"got {len(m0_by_gene)}/{len(p0_by_gene)}"
        )
    
    total_dim = sum(2 * len(s.cistron_ids) for s in specs)
    y = np.zeros((total_dim,), dtype=float)
    
    g = 0
    off = 0
    for s in specs:
        n = len(s.cistron_ids)
        for j in range(n):
            y[off + 2 * j] = float(m0_by_gene[g])
            y[off + 2 * j + 1] = float(p0_by_gene[g])
            g += 1
        off += 2 * n
    
    return y


def rk4_integrate(
    specs: List[TranscriptSpec],
    T: float,
    dt: float,
    alpha_m_base: float,
    alpha_p_base: float,
    delta_m: float,
    delta_p: float,
    m0_by_gene: np.ndarray,
    p0_by_gene: np.ndarray,
    progress_callback: Callable[[float], None] | None = None,
    inducer_configs: List[InducerConfig] | None = None,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    RK4 integration for the transcript system.
    
    Returns (t, Y) where:
        t shape (steps,)
        Y shape (steps, total_state_dim)
    """
    steps = int(np.floor(T / dt)) + 1
    t = np.linspace(0.0, dt * (steps - 1), steps)

    y = _init_state(specs, m0_by_gene, p0_by_gene)
    total_dim = len(y)

    Y = np.zeros((steps, total_dim), dtype=float)
    Y[0] = y

    protein_index_by_label = _build_protein_index(specs)

    # Progress reporting
    total_progress_steps = max(1, steps - 1)
    progress_interval = max(1, total_progress_steps // 50)
    
    # Build inducer config lookup by name for fast access
    inducer_config_by_name: dict[str, InducerConfig] = {}
    if inducer_configs:
        for ic in inducer_configs:
            inducer_config_by_name[ic.name] = ic
    
    def get_inducer_concentrations(time: float) -> dict[str, float]:
        """Compute inducer concentrations at a given time."""
        return {
            name: compute_inducer_concentration(config, time)
            for name, config in inducer_config_by_name.items()
        }
    
    for k in range(1, steps):
        current_t = t[k - 1]
        ind_conc = get_inducer_concentrations(current_t)
        
        k1 = _rhs_transcripts(y, specs, protein_index_by_label, alpha_m_base, alpha_p_base, delta_m, delta_p, ind_conc)
        y_temp = y + 0.5 * dt * k1
        
        ind_conc_mid = get_inducer_concentrations(current_t + 0.5 * dt)
        k2 = _rhs_transcripts(y_temp, specs, protein_index_by_label, alpha_m_base, alpha_p_base, delta_m, delta_p, ind_conc_mid)
        y_temp = y + 0.5 * dt * k2
        k3 = _rhs_transcripts(y_temp, specs, protein_index_by_label, alpha_m_base, alpha_p_base, delta_m, delta_p, ind_conc_mid)
        y_temp = y + dt * k3
        
        ind_conc_end = get_inducer_concentrations(current_t + dt)
        k4 = _rhs_transcripts(y_temp, specs, protein_index_by_label, alpha_m_base, alpha_p_base, delta_m, delta_p, ind_conc_end)
        
        y = y + (dt / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4)
        y = np.maximum(y, 0.0)  # clamp to non-negative
        Y[k] = y

        if progress_callback and (k == 1 or k % progress_interval == 0):
            progress_callback(float(k) / float(total_progress_steps))

    if progress_callback:
        progress_callback(1.0)

    return t, Y


def gillespie_integrate(
    specs: List[TranscriptSpec],
    T: float,
    dt: float,
    alpha_m_base: float,
    alpha_p_base: float,
    delta_m: float,
    delta_p: float,
    m0_by_gene: np.ndarray,
    p0_by_gene: np.ndarray,
    seed: int | None = None,
    progress_callback: Callable[[float], None] | None = None,
    inducer_configs: List[InducerConfig] | None = None,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Gillespie SSA for per-gene birth/death gene expression.
    
    Reactions:
        ∅ -> m_i         rate a_tx
        m_i -> ∅         rate delta_m * m_i
        m_i -> m_i + p_i rate alpha_p_base * rbsStrength_i * m_i
        p_i -> ∅         rate delta_p * p_i

    Output is sampled on the uniform dt grid by holding last state.
    """
    steps = int(np.floor(T / dt)) + 1
    tgrid = np.linspace(0.0, dt * (steps - 1), steps)

    y = _init_state(specs, m0_by_gene, p0_by_gene)
    total_dim = len(y)

    protein_index_by_label = _build_protein_index(specs)
    rng = np.random.default_rng(seed)

    Y = np.zeros((steps, total_dim), dtype=float)
    Y[0] = y
    next_sample = 1
    t = 0.0

    # Precompute per transcript slices for speed
    slices: list[tuple[int, int]] = []
    o = 0
    for s in specs:
        n = len(s.cistron_ids)
        slices.append((o, n))
        o += 2 * n
    
    # Pre-allocate propensities array for reuse
    max_reactions = sum(4 * len(s.cistron_ids) for s in specs)
    props = np.zeros(max_reactions, dtype=np.float64)

    progress_steps = max(1, steps - 1)
    progress_threshold = max(1, progress_steps // 50)
    next_progress_target = progress_threshold
    
    while t < T and next_sample < steps:
        reactions: list[tuple[str, int, int]] = []
        prop_idx = 0

        # Compute current inducer concentrations
        inducer_conc: dict[str, float] = {}
        if inducer_configs:
            for ic in inducer_configs:
                inducer_conc[ic.name] = compute_inducer_concentration(ic, t)
        
        for txi, spec in enumerate(specs):
            o, n = slices[txi]
            m = y[o : o + 2 * n : 2]
            p = y[o + 1 : o + 2 * n : 2]

            a_tx = alpha_m_base * spec.promoter_strength

            # Inducer factor
            if spec.inducer_name and inducer_conc:
                ind_val = inducer_conc.get(spec.inducer_name, 0.0)
                f_ind = hill_activation(ind_val, spec.indK, spec.indN, spec.leak)
                a_tx *= f_ind

            # Activation factor
            if spec.activator_name:
                idxs = protein_index_by_label.get(canonical_inhibitor_key(spec.activator_name))
                activator = float(np.sum(y[idxs])) if idxs is not None else 0.0
                f_act = hill_activation(activator, spec.actK, spec.actN, spec.leak)
            else:
                f_act = 1.0

            # Repression factor
            if spec.inhibitor_name:
                idxs = protein_index_by_label.get(canonical_inhibitor_key(spec.inhibitor_name))
                inhibitor = float(np.sum(y[idxs])) if idxs is not None else 0.0
                f_rep = hill_repression(inhibitor, spec.repK, spec.repN)
            else:
                f_rep = 1.0

            a_tx *= f_act * f_rep

            for j in range(n):
                # transcription (per gene)
                props[prop_idx] = max(0.0, a_tx)
                reactions.append(("tx", txi, j))
                prop_idx += 1

                # mRNA decay (per gene)
                props[prop_idx] = max(0.0, delta_m * m[j])
                reactions.append(("degm", txi, j))
                prop_idx += 1

                # translation (per gene)
                props[prop_idx] = max(0.0, alpha_p_base * spec.rbs_strengths[j] * m[j])
                reactions.append(("tl", txi, j))
                prop_idx += 1

                # protein decay (per gene)
                props[prop_idx] = max(0.0, delta_p * p[j])
                reactions.append(("degp", txi, j))
                prop_idx += 1

        props_valid = props[:prop_idx]
        a0 = float(np.sum(props_valid))
        if a0 <= 0.0:
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

        while next_sample < steps and tgrid[next_sample] <= t_next:
            Y[next_sample] = y
            next_sample += 1

            if progress_callback:
                while next_sample >= next_progress_target and next_progress_target <= progress_steps:
                    progress_callback(float(next_progress_target) / float(progress_steps))
                    next_progress_target += progress_threshold

        target = r2 * a0
        cumsum = np.cumsum(props_valid)
        mu = np.searchsorted(cumsum, target)
        if mu >= len(reactions):
            mu = len(reactions) - 1

        kind, txi, j = reactions[mu]
        o, n = slices[txi]

        if kind == "tx":
            y[o + 2 * j] += 1.0
        elif kind == "degm":
            idx = o + 2 * j
            if y[idx] > 0:
                y[idx] -= 1.0
        elif kind == "tl":
            y[o + 2 * j + 1] += 1.0
        elif kind == "degp":
            idx = o + 2 * j + 1
            if y[idx] > 0:
                y[idx] -= 1.0

        t = t_next

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
    m0_by_gene: np.ndarray,
    p0_by_gene: np.ndarray,
    seed: int | None = None,
) -> np.ndarray:
    """
    Gillespie SSA, but only returns final state at time T (no sampling).
    Much faster for flow-cytometry mode.
    """
    y = _init_state(specs, m0_by_gene, p0_by_gene)
    protein_index_by_label = _build_protein_index(specs)
    rng = np.random.default_rng(seed)

    slices: list[tuple[int, int]] = []
    o = 0
    for s in specs:
        n = len(s.cistron_ids)
        slices.append((o, n))
        o += 2 * n

    max_reactions = sum(4 * len(s.cistron_ids) for s in specs)
    props = np.zeros(max_reactions, dtype=np.float64)

    t = 0.0
    while t < T:
        reactions: list[tuple[str, int, int]] = []
        prop_idx = 0

        for txi, spec in enumerate(specs):
            o, n = slices[txi]
            m = y[o : o + 2 * n : 2]
            p = y[o + 1 : o + 2 * n : 2]

            a_tx = alpha_m_base * spec.promoter_strength
            
            if spec.activator_name:
                idxs = protein_index_by_label.get(canonical_inhibitor_key(spec.activator_name))
                activator = float(np.sum(y[idxs])) if idxs is not None else 0.0
                f_act = hill_activation(activator, spec.actK, spec.actN, spec.leak)
            else:
                f_act = 1.0

            if spec.inhibitor_name:
                idxs = protein_index_by_label.get(canonical_inhibitor_key(spec.inhibitor_name))
                inhibitor = float(np.sum(y[idxs])) if idxs is not None else 0.0
                f_rep = hill_repression(inhibitor, spec.repK, spec.repN)
            else:
                f_rep = 1.0

            a_tx *= f_act * f_rep

            for j in range(n):
                props[prop_idx] = max(0.0, a_tx)
                reactions.append(("tx", txi, j))
                prop_idx += 1

                props[prop_idx] = max(0.0, delta_m * m[j])
                reactions.append(("degm", txi, j))
                prop_idx += 1

                props[prop_idx] = max(0.0, alpha_p_base * spec.rbs_strengths[j] * m[j])
                reactions.append(("tl", txi, j))
                prop_idx += 1

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
            y[o + 2 * j] += 1.0
        elif kind == "degm":
            idx = o + 2 * j
            if y[idx] > 0:
                y[idx] -= 1.0
        elif kind == "tl":
            y[o + 2 * j + 1] += 1.0
        elif kind == "degp":
            idx = o + 2 * j + 1
            if y[idx] > 0:
                y[idx] -= 1.0

        t = t_next

    return y

