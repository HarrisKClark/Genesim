"""
Kinetics module: Hill functions and inducer concentration computation.
"""
from __future__ import annotations

import numpy as np

try:
    from numba import njit
except Exception:  # pragma: no cover
    def njit(*args, **kwargs):
        if args and callable(args[0]) and len(args) == 1 and not kwargs:
            return args[0]
        def _wrap(fn):
            return fn
        return _wrap

from .models import InducerConfig


def compute_inducer_concentration(config: InducerConfig, t: float) -> float:
    """Compute inducer concentration at time t based on the configured function."""
    func = config.function
    delay = config.delay
    baseline = config.baseline
    
    # Before delay: return baseline (or 0 for constant)
    if t < delay:
        return baseline if func != "constant" else 0.0
    
    # Effective time after delay
    t_eff = t - delay
    
    if func == "constant":
        return config.value
    
    if func == "ramp":
        # Linear ramp from baseline with given slope (starts after delay)
        return max(0.0, baseline + config.slope * t_eff)
    
    # For periodic functions: sin, square, pulse
    amplitude = config.amplitude
    period = config.period
    duty_cycle = config.duty_cycle
    
    # Normalized time within period [0, 1)
    t_norm = (t_eff % period) / period
    
    if func == "sin":
        # Oscillates between baseline and baseline+amplitude
        return baseline + amplitude * (0.5 + 0.5 * np.sin(2 * np.pi * t_norm))
    elif func == "square":
        # Repeating square wave: ON during duty cycle, OFF rest, repeats each period
        return baseline + amplitude if t_norm < duty_cycle else baseline
    elif func == "pulse":
        # Single pulse: ON for (duty_cycle * period) time after delay, then OFF forever
        pulse_duration = duty_cycle * period
        return baseline + amplitude if t_eff < pulse_duration else baseline
    else:
        return config.value


def compute_inducer_time_series(config: InducerConfig, t_array: np.ndarray) -> list[float]:
    """Compute inducer concentration at each time point."""
    return [compute_inducer_concentration(config, t) for t in t_array]


@njit
def hill_activation(activator: float, K: float, n: float, leak: float) -> float:
    """JIT-compiled Hill activation function."""
    if K <= 0.0:
        return leak
    An = activator ** n
    Kn = K ** n
    hill = An / (Kn + An)
    return leak + (1.0 - leak) * hill


@njit
def hill_repression(inhibitor: float, K: float, n: float) -> float:
    """JIT-compiled Hill repression function."""
    if K <= 0.0:
        return 1.0
    ratio = inhibitor / K
    return 1.0 / (1.0 + ratio ** n)


def norm_label(s: str) -> str:
    """Normalize for robust matching (e.g. 'LacI' vs 'Lac I' vs 'lac i')."""
    return "".join(ch.lower() for ch in s if ch.isalnum())


def canonical_inhibitor_key(s: str) -> str:
    """
    Map common synonym spellings to a canonical inhibitor key so promoter<->protein matching
    works across the whole app, even if older circuits use different names.
    """
    n = norm_label(s)
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

