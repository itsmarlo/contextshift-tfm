"""Context selection and independent, seeded interventions."""
import numpy as np
import pandas as pd
from .generate_dataset import FEATURES


def nested_context(pool: pd.DataFrame, size: int, seed: int) -> pd.DataFrame:
    if size < 1 or size > len(pool):
        raise ValueError('context size outside available pool')
    order = np.random.default_rng(seed).permutation(len(pool))
    # Seed the nested sequence with both labels when available, so small contexts are evaluable.
    if 'label' in pool and pool.label.nunique() == 2 and size >= 2:
        first_zero = next(i for i in order if pool.iloc[i].label == 0)
        first_one = next(i for i in order if pool.iloc[i].label == 1)
        order = np.concatenate(([first_zero, first_one], order[(order != first_zero) & (order != first_one)]))
    return pool.iloc[order[:size]].copy().reset_index(drop=True)


def stratified_context(pool: pd.DataFrame, size: int, share: float, column: str, seed: int) -> pd.DataFrame:
    if not 0 <= share <= 1 or size < 1:
        raise ValueError('invalid share or context size')
    n1 = round(size * share)
    n0 = size - n1
    a, b = pool[pool[column] == 0], pool[pool[column] == 1]
    if len(a) < n0 or len(b) < n1:
        raise ValueError('insufficient rows for requested composition')
    return pd.concat([a.sample(n=n0, random_state=seed), b.sample(n=n1, random_state=seed + 1)], ignore_index=True).sample(frac=1, random_state=seed + 2).reset_index(drop=True)


def corrupt_context(context: pd.DataFrame, kind: str, level: float, seed: int) -> pd.DataFrame:
    if not 0 <= level <= 1:
        raise ValueError('corruption level must be in [0,1]')
    result = context.copy(deep=True)
    rng = np.random.default_rng(seed)
    if kind == 'labels':
        mask = rng.random(len(result)) < level
        result.loc[mask, 'label'] = 1 - result.loc[mask, 'label']
    elif kind == 'missing':
        mask = rng.random((len(result), len(FEATURES))) < level
        result = result.astype({column: float for column in FEATURES})
        result.loc[:, FEATURES] = result[FEATURES].mask(mask)
    elif kind == 'noise':
        for col, scale in [('premium', 800), ('age', 20), ('insured', 60)]:
            result[col] = result[col] + rng.normal(0, level * scale, len(result))
    elif kind == 'outliers':
        mask = rng.random(len(result)) < level
        result.loc[mask, 'premium'] = result.loc[mask, 'premium'] * 5
        result.loc[mask, 'insured'] = result.loc[mask, 'insured'] * 4
    else:
        raise ValueError(f'unknown intervention: {kind}')
    return result


def drift_context(historical: pd.DataFrame, recent: pd.DataFrame, size: int, recent_share: float, seed: int) -> pd.DataFrame:
    if not 0 <= recent_share <= 1:
        raise ValueError('recent_share must be in [0,1]')
    n_recent = round(size * recent_share)
    n_old = size - n_recent
    if n_old > len(historical) or n_recent > len(recent):
        raise ValueError('insufficient rows')
    return pd.concat([nested_context(historical, n_old, seed) if n_old else historical.iloc[:0],
                      nested_context(recent, n_recent, seed + 1) if n_recent else recent.iloc[:0]], ignore_index=True)
