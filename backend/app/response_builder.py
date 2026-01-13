"""
Response builder module: Functions for building simulation response objects.
"""
from __future__ import annotations

from typing import List

import numpy as np

from .integrators import TranscriptSpec
from .kinetics import compute_inducer_time_series
from .models import (
    InducerTimeSeries,
    SimulationParams,
    SimulateTranscriptsResponse,
    SummaryRow,
    TimeSeries,
    TranscriptResult,
)


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
        m = Y[:, off : off + 2 * n : 2]
        p = Y[:, off + 1 : off + 2 * n : 2]
        results.append({
            "id": spec.transcript_id,
            "m": m,
            "p": p,
            "cistron_ids": spec.cistron_ids,
        })
        off += 2 * n
    return results


def initial_by_gene_from_params(
    specs: List[TranscriptSpec],
    params: SimulationParams,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Returns (m0_by_gene, p0_by_gene) flattened in request order:
        specs[0].cistrons[0..] then specs[1].cistrons[0..], ...
    """
    total_genes = sum(len(s.cistron_ids) for s in specs)

    if params.m0_by_gene is not None:
        if len(params.m0_by_gene) != total_genes:
            raise ValueError(
                f"m0_by_gene must have length {total_genes}, got {len(params.m0_by_gene)}"
            )
        m0 = np.array(params.m0_by_gene, dtype=float)
    else:
        m0 = np.full((total_genes,), float(params.m0), dtype=float)

    if params.p0_by_gene is not None:
        if len(params.p0_by_gene) != total_genes:
            raise ValueError(
                f"p0_by_gene must have length {total_genes}, got {len(params.p0_by_gene)}"
            )
        p0 = np.array(params.p0_by_gene, dtype=float)
    else:
        p0 = np.full((total_genes,), float(params.p0), dtype=float)

    return m0, p0


def build_time_series_response(
    transcripts,
    specs: List[TranscriptSpec],
    t: np.ndarray,
    Y: np.ndarray,
    params: SimulationParams | None = None,
) -> SimulateTranscriptsResponse:
    """Build the response object for time series simulation results."""
    packed = unpack_results(t, Y, specs)

    transcript_results: list[TranscriptResult] = []
    summary: list[SummaryRow] = []

    packed_by_id = {r["id"]: r for r in packed}

    for tx in transcripts:
        r = packed_by_id.get(tx.id)
        if r is None:
            continue

        m_mat = r["m"]  # (steps, n_cistrons)
        p_mat = r["p"]  # (steps, n_cistrons)
        m_sum_series = np.sum(m_mat, axis=1).tolist()

        proteins: list[TimeSeries] = []
        final_proteins: list[float] = []
        mRNAs: list[TimeSeries] = []

        for idx, c in enumerate(tx.cistrons):
            label = c.geneName
            m_vals = m_mat[:, idx].tolist()
            mRNAs.append(TimeSeries(id=f"{c.id}:mRNA", label=f"{label} mRNA", values=m_vals))
            vals = p_mat[:, idx].tolist()
            proteins.append(TimeSeries(id=c.id, label=label, values=vals))
            final_proteins.append(float(vals[-1]))

        transcript_results.append(
            TranscriptResult(
                id=tx.id,
                promoterName=tx.promoterName,
                terminatorName=tx.terminatorName,
                mRNA=TimeSeries(
                    id=f"{tx.id}:mRNA",
                    label=f"{tx.promoterName} total mRNA",
                    values=m_sum_series,
                ),
                mRNAs=mRNAs,
                proteins=proteins,
            )
        )

        summary.append(
            SummaryRow(
                transcriptId=tx.id,
                promoterName=tx.promoterName,
                cistronCount=len(tx.cistrons),
                final_mRNA=float(m_sum_series[-1]),
                final_proteins=final_proteins,
            )
        )

    # Compute inducer time series if configured
    inducer_series: list[InducerTimeSeries] | None = None
    if params and params.inducers:
        inducer_series = []
        for inducer_config in params.inducers:
            values = compute_inducer_time_series(inducer_config, t)
            inducer_series.append(InducerTimeSeries(name=inducer_config.name, values=values))

    return SimulateTranscriptsResponse(
        time=t.tolist(),
        transcripts=transcript_results,
        summary=summary,
        inducers=inducer_series,
    )

