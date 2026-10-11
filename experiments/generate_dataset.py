"""Generate synthetic insurance observations. No generated relation is a real causal claim."""
from dataclasses import dataclass
import numpy as np
import pandas as pd

FEATURES = ['age', 'premium', 'previousClaims', 'duration', 'insured', 'risk', 'geo', 'payment']
DATASET_VERSION = 'synthetic-insurance-v1'

@dataclass(frozen=True)
class Dataset:
    pool: pd.DataFrame
    test: pd.DataFrame
    recent_pool: pd.DataFrame
    recent_test: pd.DataFrame


def generate_population(n: int, seed: int, *, period: str = 'A', b_share: float = .5) -> pd.DataFrame:
    if n < 1 or not 0 <= b_share <= 1:
        raise ValueError('n must be positive and b_share must be in [0,1]')
    rng = np.random.default_rng(seed)
    b = rng.random(n) < b_share
    age = np.clip(rng.normal(38 + b * 12, 11), 18, 80).round()
    duration = np.clip(rng.gamma(2.2, 2.1, n) + b * 3, .5, 20).round(1)
    risk = np.clip(1 + b.astype(int) + rng.binomial(1, .35, n), 1, 3)
    previous = np.clip(rng.poisson(.3 + .5 * b + .24 * (risk - 1)), 0, 6)
    geo = rng.binomial(1, .2 + .35 * b, n)
    payment = np.clip(rng.poisson(.12 + .24 * b + .1 * (risk - 1)), 0, 4)
    insured = np.clip(rng.normal(55 + b * 45 + age * .3, 19), 15, 200).round(1)
    premium = np.clip(450 + insured * 8 + risk * 155 + previous * 90 + rng.normal(0, 150, n), 300, 4000).round()
    logit = (-3.1 + .35 * previous + .32 * (risk - 1) + .33 * geo + .23 * payment
             + .0002 * (premium - 1200) + .0017 * (age - 45) ** 2
             - .048 * duration + .16 * b)
    if period == 'B':
        logit = logit + .55 - .55 * previous + .14 * duration
    elif period != 'A':
        raise ValueError('period must be A or B')
    probability = 1 / (1 + np.exp(-logit))
    frame = pd.DataFrame(dict(age=age, premium=premium, previousClaims=previous,
        duration=duration, insured=insured, risk=risk, geo=geo, payment=payment,
        label=rng.binomial(1, probability), population=b.astype(int), period=period))
    return frame


def make_dataset(seed: int = 2026, pool_size: int = 2200, test_size: int = 320) -> Dataset:
    # Separate RNG streams ensure held-out observations never depend on sampling or interventions.
    return Dataset(generate_population(pool_size, seed), generate_population(test_size, seed + 10_000),
        generate_population(pool_size, seed + 20_000, period='B', b_share=.65),
        generate_population(test_size, seed + 30_000, period='B', b_share=.65))
